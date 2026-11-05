import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import { Dialogue } from '../systems/DialogueManager';
import { buildCaliSign, type CaliSign } from './SignArtCali';
import { buildMallSign, type MallSign } from './SignArtMall';
import { drawPanel } from './theme';

/**
 * Arte de los carteles "dibujados a mano" más elaborados de SignView: la servilleta del oficinista,
 * el cuaderno de repaso, la carta del convenio, los rayos X del aeropuerto y la balanza del check-in.
 */

/** Servilleta con el mapa del atajo por la galería. */
export interface NapkinSign {
  kind: 'servilleta';
}

/** Hoja cuadriculada con las reglas de la mochila y el cuervo al margen. */
export interface NotebookSign {
  kind: 'cuaderno';
}

/** Carta del convenio UAV + PUCC con timbre animado. */
export interface LetterSign {
  kind: 'convenio';
}

/** Pantalla de rayos X con los frascos de manjar marcados en rojo. */
export interface XraySign {
  kind: 'rayosx';
}

/** Pantallita LCD de la balanza del counter: cuenta hasta el valor de la variable de diálogo `var`. */
export interface ScaleSign {
  kind: 'balanza';
  /** Variable de Dialogue.vars con los kilos (la misma que usa el texto, ej. "peso"). */
  var: string;
  /** Límite de la aerolínea, en kilos. */
  max: number;
}

/** Los del mall (afiche del cine, ascensor, confitería) y el kiosco fantasma viven en SignArtMall.ts. */
export type ArtSign = NapkinSign | NotebookSign | LetterSign | XraySign | ScaleSign | MallSign | CaliSign;

/** Lo que el arte necesita de SignView. */
export interface SignCtx {
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  text(x: number, y: number, text: string, style?: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text;
  /** Registra una animación para cortarla si el cartel se cierra antes de que termine. */
  track(tween: Phaser.Tweens.Tween): void;
}

/** Tinta azul de lápiz pasta. */
const PEN = 0x2848a8;
const PEN_CSS = '#2848a8';
/** La balanza cuelga un poco más abajo que los letreros. */
const TOP_SCALE = 14;

export function buildArtSign(ctx: SignCtx, s: ArtSign): void {
  switch (s.kind) {
    case 'servilleta':
      buildNapkin(ctx);
      playSfx('page');
      break;
    case 'cuaderno':
      buildNotebook(ctx);
      playSfx('page');
      break;
    case 'convenio':
      buildLetter(ctx);
      playSfx('page');
      break;
    case 'rayosx':
      buildXray(ctx);
      break;
    case 'balanza':
      buildScale(ctx, s);
      break;
    case 'rutas':
    case 'carnet_pucc':
    case 'mural_pucc':
      buildCaliSign(ctx, s);
      break;
    default:
      buildMallSign(ctx, s);
  }
}

// ---------------------------------------------------------------------------
// Servilleta del oficinista
// ---------------------------------------------------------------------------

function buildNapkin(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 200;
  const h = 104;
  root.setPosition((BASE_WIDTH - w) / 2, 6);
  const g = scene.add.graphics();
  // Sombra y borde ondulado: festón de circulitos alrededor del cuadrado.
  g.fillStyle(0x000000, 0.15).fillRect(2, 3, w, h);
  g.fillStyle(0xfbfbf6, 1);
  for (let x = 3; x <= w - 3; x += 6) g.fillCircle(x, 3, 3).fillCircle(x, h - 3, 3);
  for (let y = 3; y <= h - 3; y += 6) g.fillCircle(3, y, 3).fillCircle(w - 3, y, 3);
  g.fillRect(3, 3, w - 6, h - 6);
  // Relieve de la servilleta: borde punteado y pliegues en cruz.
  g.fillStyle(0xd8d8cc, 1);
  for (let x = 8; x < w - 8; x += 3) g.fillRect(x, 7, 1, 1).fillRect(x, h - 8, 1, 1);
  for (let y = 8; y < h - 8; y += 3) g.fillRect(7, y, 1, 1).fillRect(w - 8, y, 1, 1);
  g.lineStyle(1, 0xe4e4da, 1).lineBetween(w / 2, 8, w / 2, h - 8).lineBetween(8, h / 2, w - 8, h / 2);
  // Mancha de café (la servilleta venía de la reunión).
  g.lineStyle(2, 0xc8a070, 0.35).strokeCircle(w - 34, h - 26, 11);
  g.lineStyle(1, 0xc8a070, 0.25).strokeCircle(w - 33, h - 25, 8);
  root.add(g);

  const pen = scene.add.graphics();
  pen.lineStyle(1, PEN, 0.9);
  // Av. Providencia: dos líneas temblorosas de lado a lado.
  const wobble = (y: number) => {
    pen.beginPath();
    pen.moveTo(14, y);
    for (let x = 14; x <= w - 14; x += 8) pen.lineTo(x, y + ((x / 8) % 2 ? 1 : 0));
    pen.strokePath();
  };
  wobble(64);
  wobble(72);
  // Nueva Tajamar, arriba.
  pen.lineBetween(30, 22, 158, 22).lineBetween(30, 30, 150, 30);
  // Galería Los Leones: un rectángulo entre las dos calles.
  pen.strokeRect(36, 34, 30, 26);
  pen.lineBetween(36, 40, 66, 40);
  // Torre Costanera: alta, angostita, con rayitas de ventanas.
  pen.lineStyle(1, PEN, 1);
  pen.strokePoints([new Phaser.Math.Vector2(162, 60), new Phaser.Math.Vector2(164, 14), new Phaser.Math.Vector2(170, 8), new Phaser.Math.Vector2(176, 14), new Phaser.Math.Vector2(178, 60)], true);
  for (let y = 18; y < 58; y += 5) pen.lineBetween(166, y, 175, y);
  // "Ud. está aquí": una X al sur de Providencia.
  pen.lineStyle(1, 0xc8202c, 0.9).lineBetween(47, 79, 53, 85).lineBetween(53, 79, 47, 85);
  root.add(pen);

  const label = (x: number, y: number, text: string, size = 6, angle = 0) =>
    root.add(ctx.text(x, y, text, { fontSize: `${size}px`, fontStyle: 'italic', color: PEN_CSS }).setAngle(angle));
  label(80, 74, 'Av. Providencia', 7);
  label(70, 12, 'Nueva Tajamar', 6);
  label(68, 42, 'Galería', 6);
  label(68, 49, 'Los Leones', 6);
  label(148, 62, 'COSTANERA', 6, -4);
  label(56, 82, 'Ud.', 6);
  root.add(ctx.text(w - 12, h - 20, 'Atte., el oficinista apurado', { fontSize: '6px', fontStyle: 'italic', color: PEN_CSS }).setOrigin(1, 0).setAngle(-3));

  // La flecha del atajo se dibuja sola, como si el lápiz pasta la estuviera trazando.
  const path = [
    [50, 77],
    [50, 60],
    [52, 44],
    [52, 26],
    [100, 26],
    [154, 26],
  ];
  const lens = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const arrow = scene.add.graphics();
  root.add(arrow);
  const draw = (t: number) => {
    arrow.clear();
    arrow.lineStyle(2, PEN, 1).beginPath();
    arrow.moveTo(path[0][0], path[0][1]);
    let left = total * t;
    let end = path[0];
    for (let i = 1; i < path.length && left > 0; i++) {
      const k = Math.min(1, left / lens[i - 1]);
      end = [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k];
      arrow.lineTo(end[0], end[1]);
      left -= lens[i - 1];
    }
    arrow.strokePath();
    if (t >= 1) arrow.fillStyle(PEN, 1).fillTriangle(154, 22, 154, 30, 160, 26);
  };
  draw(0);
  const counter = { t: 0 };
  ctx.track(scene.tweens.add({ targets: counter, t: 1, delay: 200, duration: 900, ease: 'Sine.InOut', onUpdate: () => draw(counter.t) }));
}

// ---------------------------------------------------------------------------
// Cuaderno de repaso
// ---------------------------------------------------------------------------

function buildNotebook(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 264;
  const h = 104;
  root.setPosition((BASE_WIDTH - w) / 2, 6);
  const g = scene.add.graphics();
  drawPanel(g, 0, 0, w, h, { radius: 1, fill: 0xf8f8f0, edge: 0xb0b0a4 });
  // Cuadrícula celeste de 6 px y margen rojo.
  g.lineStyle(1, 0xc4d8ec, 0.8);
  for (let x = 6; x < w; x += 6) g.lineBetween(x, 1, x, h - 1);
  for (let y = 6; y < h; y += 6) g.lineBetween(1, y, w - 1, y);
  g.lineStyle(1, 0xe08080, 0.9).lineBetween(24, 1, 24, h - 1);
  // Perforaciones del anillado.
  for (let y = 10; y < h - 4; y += 12) g.fillStyle(0xd0ccc0, 1).fillCircle(9, y, 2.5);
  root.add(g);

  const ink = '#24347a';
  root.add(ctx.text(30, 4, 'MOCHILA 0/1 · REPASO', { fontFamily: FONT_HUD, fontSize: '8px', color: ink }));
  g.lineStyle(1, 0x24347a, 0.8).lineBetween(30, 15, 152, 15).lineBetween(30, 17, 120, 17);

  const rules = [
    '1. Cada objeto entero o nada (x_i = 0 ó 1).',
    '   Máx. VALOR sin pasarse de la CAPACIDAD.',
    '2. Golosa: ordenar por valor/peso y llenar.',
    '   ¡En la 0/1 NO siempre da el óptimo!',
    '3. Fraccionaria: ahí la golosa SÍ es óptima.',
    '4. Prog. dinámica: tabla n × W → O(n·W)',
  ];
  rules.forEach((line, i) => {
    const y = 22 + i * 12;
    const t = ctx.text(30, y, line, { fontSize: '7px', color: ink });
    if (i === 3) {
      // Destacado con plumón amarillo.
      g.fillStyle(0xf8f060, 0.55).fillRect(28, y + 1, Math.ceil(t.width) + 4, 8);
    }
    if (i === rules.length - 1) {
      // Círculo rojo alrededor del O(n·W).
      const tail = ctx.text(0, 0, 'O(n·W)', { fontSize: '7px' });
      const cx = Math.round(30 + t.width - tail.width / 2);
      g.lineStyle(1, 0xc8202c, 0.85).strokeEllipse(cx, y + 5, Math.ceil(tail.width) + 8, 12);
      tail.destroy();
    }
    root.add(t);
  });

  // Garabato al margen: un cuervo con calculadora (se balancea un poquito).
  const doodle = scene.add.graphics();
  doodle.lineStyle(1, 0x24347a, 0.9);
  doodle.strokeEllipse(0, 6, 18, 14); // cuerpo
  doodle.strokeCircle(4, -5, 5); // cabeza
  doodle.fillStyle(0x24347a, 1).fillCircle(5, -6, 1); // ojo
  doodle.fillTriangle(8, -6, 8, -3, 13, -4); // pico
  doodle.lineBetween(-6, 4, -12, 10).lineBetween(-12, 10, -4, 10); // ala
  doodle.lineBetween(-2, 13, -3, 17).lineBetween(2, 13, 3, 17); // patas
  // Calculadora en el ala.
  doodle.strokeRect(6, 2, 9, 12);
  doodle.strokeRect(7, 3, 7, 3);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) doodle.fillRect(7 + c * 2.5, 8 + r * 3, 1, 1);
  const crow = scene.add.container(232, 60, [doodle, ctx.text(-14, 18, '¡óptimo!', { fontSize: '6px', fontStyle: 'italic', color: ink })]);
  root.add(crow);
  ctx.track(scene.tweens.add({ targets: crow, angle: { from: -4, to: 4 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
}

// ---------------------------------------------------------------------------
// Carta del convenio
// ---------------------------------------------------------------------------

/** Apaisada y bajita: deja espacio a las opciones que aparecen al final de la noticia. */
function buildLetter(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 228;
  const h = 76;
  root.setPosition((BASE_WIDTH - w) / 2, 4);
  const g = scene.add.graphics();
  drawPanel(g, 0, 0, w, h, { radius: 1, fill: 0xfcfaf2, edge: 0x9a9080 });
  const paper = scene.add.container(0, 0, [g]);
  root.add(paper);

  // Membrete: escudo UAV a la izquierda, sol de la PUCC a la derecha.
  g.fillStyle(0x1c2a48, 1).fillRect(5, 4, 14, 14);
  g.fillStyle(0xd8b048, 1).fillRect(8, 6, 8, 6).fillTriangle(8, 12, 16, 12, 12, 16);
  paper.add(ctx.text(22, 5, 'UAV', { fontFamily: FONT_HUD, fontSize: '8px', color: '#1c2a48' }));
  g.fillStyle(0x2f8a4a, 1).fillCircle(w - 12, 11, 7);
  g.fillStyle(0xf0c818, 1).fillCircle(w - 12, 11, 3);
  g.lineStyle(1, 0xf0c818, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.lineBetween(w - 12 + Math.cos(a) * 4, 11 + Math.sin(a) * 4, w - 12 + Math.cos(a) * 6, 11 + Math.sin(a) * 6);
  }
  paper.add(ctx.text(w - 22, 5, 'PUCC', { fontFamily: FONT_HUD, fontSize: '8px', color: '#2f6a3a' }).setOrigin(1, 0));
  paper.add(ctx.text(w / 2, 4, 'Universidad Antonio Varas', { fontSize: '5px', color: '#5a5468' }).setOrigin(0.5, 0));
  paper.add(ctx.text(w / 2, 10, 'Pontificia Univ. Cristiana-Caleña', { fontSize: '5px', color: '#5a5468' }).setOrigin(0.5, 0));
  g.fillStyle(0x1c2a48, 1).fillRect(5, 20, w - 10, 1);
  g.fillStyle(0xd8b048, 1).fillRect(5, 22, w - 10, 1);

  // Título y, al lado del destino, la banderita colombiana.
  paper.add(ctx.text(w / 2, 25, 'CONVENIO DE INTERCAMBIO', { fontFamily: FONT_HUD, fontSize: '8px', color: '#1c2a48' }).setOrigin(0.5, 0));
  const dest = ctx.text(w / 2 - 8, 34, 'CALI, COLOMBIA', { fontFamily: FONT_HUD, fontSize: '6px', color: '#c0283c' }).setOrigin(0.5, 0);
  paper.add(dest);
  const fx = Math.round(w / 2 - 8 + dest.width / 2 + 4);
  g.fillStyle(0xf0c818, 1).fillRect(fx, 34, 12, 4);
  g.fillStyle(0x2048a0, 1).fillRect(fx, 38, 12, 2);
  g.fillStyle(0xc8202c, 1).fillRect(fx, 40, 12, 2);
  g.lineStyle(1, 0x000000, 0.25).strokeRect(fx, 34, 12, 8);

  paper.add(ctx.text(8, 44, 'Se otorga al estudiante Feli P. un semestre de intercambio en la', { fontSize: '6px', color: '#2a2433' }));
  paper.add(ctx.text(8, 51, 'PUCC (Cali), con matrícula, pasajes y estadía cubiertos.', { fontSize: '6px', color: '#2a2433' }));

  // Firmas.
  g.lineStyle(1, 0x2a2433, 0.6).lineBetween(14, 67, 74, 67).lineBetween(90, 67, 150, 67);
  g.lineStyle(1, 0x2040a0, 0.9).beginPath();
  g.moveTo(18, 65);
  for (let k = 1; k <= 8; k++) g.lineTo(18 + k * 6, 65 - (k % 2 ? 5 : 0) + (k === 8 ? 2 : 0));
  g.strokePath();
  g.beginPath();
  g.moveTo(96, 64);
  g.lineTo(104, 59).lineTo(108, 65).lineTo(118, 60).lineTo(128, 64).lineTo(142, 61);
  g.strokePath();
  paper.add(ctx.text(44, 68, 'Rector UAV', { fontSize: '5px', color: '#5a5468' }).setOrigin(0.5, 0));
  paper.add(ctx.text(120, 68, 'Rectora PUCC', { fontSize: '5px', color: '#5a5468' }).setOrigin(0.5, 0));

  // El timbre cae sobre la carta y la sacude.
  const sg = scene.add.graphics();
  const red = 0xc0283c;
  sg.lineStyle(2, red, 1).strokeCircle(0, 0, 17);
  sg.lineStyle(1, red, 1).strokeCircle(0, 0, 13);
  sg.fillStyle(red, 1).fillRect(-16, -4, 32, 9);
  const stampText = ctx.text(0, -4, 'APROBADO', { fontFamily: FONT_HUD, fontSize: '6px', color: '#fcfaf2' }).setOrigin(0.5, 0);
  const stampTop = ctx.text(0, -12, 'UAV', { fontSize: '5px', fontStyle: '600', color: '#c0283c' }).setOrigin(0.5, 0);
  const stampBottom = ctx.text(0, 6, 'PUCC', { fontSize: '5px', fontStyle: '600', color: '#c0283c' }).setOrigin(0.5, 0);
  const stamp = scene.add.container(w - 34, 54, [sg, stampText, stampTop, stampBottom]).setAngle(-28).setScale(2.4).setAlpha(0);
  paper.add(stamp);
  ctx.track(
    scene.tweens.add({
      targets: stamp,
      scale: 1,
      alpha: 0.85,
      angle: -12,
      delay: 650,
      duration: 160,
      ease: 'Quad.In',
      onComplete: () => {
        playSfx('bump');
        ctx.track(scene.tweens.add({ targets: paper, y: 2, duration: 45, yoyo: true, ease: 'Quad.Out' }));
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Rayos X del control de seguridad
// ---------------------------------------------------------------------------

/** Monitor bajito: las opciones del guardia salen a la derecha, sobre la caja de diálogo. */
function buildXray(ctx: SignCtx): void {
  const { scene, root } = ctx;
  const w = 220;
  const h = 78;
  root.setPosition((BASE_WIDTH - w) / 2, 4);
  const g = scene.add.graphics();
  drawPanel(g, 0, 0, w, h, { radius: 3, fill: 0x2a2e36, edge: 0x0e1014 });
  const sx = 5;
  const sy = 5;
  const sw = w - 10;
  const sh = h - 10;
  g.fillStyle(0x0a1430, 1).fillRect(sx, sy, sw, sh);
  // Líneas de barrido del monitor.
  g.fillStyle(0xffffff, 0.04);
  for (let y = sy; y < sy + sh; y += 2) g.fillRect(sx, y, sw, 1);
  root.add(g);
  root.add(ctx.text(sx + 3, sy + 2, 'AVSEC · RX-2', { fontFamily: FONT_HUD, fontSize: '6px', color: '#58c8e8' }));
  root.add(ctx.text(sx + sw - 3, sy + 2, 'BANDEJA 117', { fontFamily: FONT_HUD, fontSize: '6px', color: '#58c8e8' }).setOrigin(1, 0));

  // La mochila: naranjo = orgánico, azul = metal (la paleta típica de los rayos X).
  const bag = scene.add.graphics();
  const bx = 0;
  const by = 0;
  bag.fillStyle(0xe8902c, 0.28).fillRoundedRect(bx, by, 96, 50, 8);
  bag.lineStyle(1, 0xf0a848, 0.8).strokeRoundedRect(bx, by, 96, 50, 8);
  bag.lineStyle(2, 0xf0a848, 0.6).strokeRoundedRect(bx + 34, by - 7, 28, 12, 5); // manilla
  bag.fillStyle(0x3c78d8, 0.9);
  for (let x = bx + 8; x < bx + 88; x += 4) bag.fillRect(x, by + 4, 2, 1); // cierre
  // Cuaderno, calculadora, audífonos y el chicle.
  bag.fillStyle(0xe8902c, 0.55).fillRect(bx + 6, by + 10, 26, 34);
  bag.fillStyle(0x3c78d8, 0.85).fillRect(bx + 36, by + 12, 12, 18);
  bag.fillStyle(0x0a1430, 1);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) bag.fillRect(bx + 38 + c * 3, by + 19 + r * 3, 2, 2);
  bag.lineStyle(1, 0x3c78d8, 0.9).strokeCircle(bx + 44, by + 40, 5);
  bag.lineBetween(bx + 49, by + 40, bx + 54, by + 46);
  // Los dos tarros de manjar: densos, oscuros, con tapa de metal.
  const jars = [
    [60, 18],
    [76, 20],
  ];
  for (const [jx, jy] of jars) {
    bag.fillStyle(0xb85818, 0.95).fillRoundedRect(bx + jx, by + jy, 12, 22, 2);
    bag.fillStyle(0x3c78d8, 1).fillRect(bx + jx - 1, by + jy - 3, 14, 4);
  }
  const bagX = sx + 10;
  const bagY = sy + 13;
  const bagC = scene.add.container(bagX, bagY, [bag]);
  root.add(bagC);

  // Recuadros rojos parpadeando sobre los tarros.
  const alert = scene.add.graphics();
  alert.lineStyle(1, 0xff3030, 1);
  for (const [jx, jy] of jars) alert.strokeRect(bagX + jx - 3, bagY + jy - 6, 18, 30);
  alert.setAlpha(0);
  root.add(alert);
  const warn = ctx.text(sx + sw - 4, sy + sh - 22, '! REVISIÓN MANUAL', { fontFamily: FONT_HUD, fontSize: '6px', color: '#ff5050' }).setOrigin(1, 0).setAlpha(0);
  const info = ctx.text(sx + sw - 4, sy + sh - 12, 'PASTA > 100 ML · x2', { fontSize: '6px', color: '#f0a848' }).setOrigin(1, 0).setAlpha(0);
  root.add([warn, info]);
  // Columna de densidad a la derecha (decorativa).
  const meter = scene.add.graphics();
  [0x3c78d8, 0x58a858, 0xe8902c, 0xb85818].forEach((c, i) => meter.fillStyle(c, 0.9).fillRect(sx + sw - 10, sy + 14 + i * 7, 6, 6));
  root.add(meter);

  // La bandeja entra por la cinta y se detiene; recién ahí saltan las alarmas.
  bagC.setX(sx - 40).setAlpha(0);
  ctx.track(
    scene.tweens.add({
      targets: bagC,
      x: bagX,
      alpha: 1,
      duration: 700,
      ease: 'Cubic.Out',
      onComplete: () => {
        playSfx('error');
        info.setAlpha(1);
        ctx.track(scene.tweens.add({ targets: [alert, warn], alpha: { from: 1, to: 0.15 }, duration: 260, yoyo: true, repeat: -1 }));
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Balanza del check-in
// ---------------------------------------------------------------------------

function buildScale(ctx: SignCtx, s: ScaleSign): void {
  const { scene, root } = ctx;
  const kg = Number(Dialogue.vars.get(s.var)) || 0;
  const w = 132;
  const h = 64;
  root.setPosition((BASE_WIDTH - w) / 2, TOP_SCALE);
  const g = scene.add.graphics();
  // Cuerpo de plástico gris con su cable.
  g.fillStyle(0x3a3a42, 1).fillRect(w / 2 - 1, -TOP_SCALE, 2, TOP_SCALE);
  drawPanel(g, 0, 0, w, h, { radius: 4, fill: 0xc8ccd4, edge: 0x5a5e68 });
  g.fillStyle(0xb0b4bc, 1).fillRect(4, h - 8, w - 8, 4);
  root.add(g);
  root.add(ctx.text(8, 4, 'BALANZA · COUNTER 14', { fontFamily: FONT_HUD, fontSize: '6px', color: '#3a3e48' }));

  // Ventana LCD verde.
  const lx = 10;
  const ly = 14;
  const lw = w - 20;
  const lh = 30;
  g.fillStyle(0x23302a, 1).fillRoundedRect(lx - 2, ly - 2, lw + 4, lh + 4, 3);
  g.fillStyle(0x9cc878, 1).fillRect(lx, ly, lw, lh);
  g.fillStyle(0xb8e090, 0.6).fillRect(lx, ly, lw, 3);
  const digits = { fontFamily: FONT_HUD, fontSize: '16px', color: '#1c2c18' };
  // Segmentos apagados de fondo, como en las pantallitas de verdad.
  root.add(ctx.text(lx + lw - 22, ly + 6, '88,8', digits).setOrigin(1, 0).setAlpha(0.12));
  const value = ctx.text(lx + lw - 22, ly + 6, '0,0', digits).setOrigin(1, 0);
  root.add(value);
  root.add(ctx.text(lx + lw - 4, ly + 14, 'kg', { fontFamily: FONT_HUD, fontSize: '8px', color: '#1c2c18' }).setOrigin(1, 0));
  const stable = ctx.text(lx + 3, ly + 2, 'ESTABLE', { fontFamily: FONT_HUD, fontSize: '5px', color: '#1c2c18' }).setAlpha(0);
  root.add(stable);

  // Luz de estado y el límite.
  const led = scene.add.graphics();
  const drawLed = (color: number) => led.clear().fillStyle(color, 1).fillCircle(w - 12, h - 13, 2.5);
  drawLed(0xe0a030);
  root.add(led);
  root.add(ctx.text(10, h - 17, `LÍMITE ${s.max},0 kg`, { fontSize: '6px', fontStyle: '600', color: '#3a3e48' }));

  const fmt = (v: number) => Math.max(0, v).toFixed(1).replace('.', ',');
  const counter = { v: 0 };
  ctx.track(
    scene.tweens.add({
      targets: counter,
      v: kg,
      delay: 150,
      duration: 1100,
      ease: 'Cubic.Out',
      // Al final la aguja "baila" un poco antes de asentarse.
      onUpdate: (tw) => value.setText(fmt(tw.progress < 0.9 ? counter.v + Math.sin(tw.progress * 40) * 0.4 : counter.v)),
      onComplete: () => {
        value.setText(fmt(kg));
        stable.setAlpha(1);
        drawLed(kg <= s.max ? 0x40c060 : 0xe03030);
        playSfx('bip');
        if (kg === s.max) {
          // Justo en el límite: el número parpadea de orgullo.
          ctx.track(scene.tweens.add({ targets: value, alpha: 0.3, duration: 220, yoyo: true, repeat: 3 }));
        }
      },
    }),
  );
}
