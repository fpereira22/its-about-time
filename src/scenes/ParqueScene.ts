import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import type { AtraccionResult } from './AtraccionScene';
import { MiniScene } from './MiniScene';

/**
 * Misión 8: el resto de los juegos del Parque del Café, cada uno con su mecánica (Esc: bajarte).
 *  - `rapidos`: Los Rápidos, desde arriba. A/D llevan el bote redondo por el río; E le da un giro de un cuarto.
 *    Las cascadas y los chorros mojan sobre todo al que va mirando hacia ellos: esquívalos o gira el bote para
 *    que le caigan a otro (a Renzo, por ejemplo, que nunca se moja).
 *  - `fabulas`: el Lago de Fábulas: botes chocones con cañón de agua. W avanza, A/D giran, E dispara. Mojar a
 *    otro bote suma; a los patos de verdad, no. 40 segundos.
 *  - `tren`: el Tren del Café. Desde la ventana: E para saludar cuando pasa alguien que saluda, F para pitar en
 *    los letreros de «PITE» y para correr a la vaca.
 *  - `show`: el Show del Café: un pasillo en 3/4 con una bailarina. A/D: los pasos; E: la vuelta.
 *  - `ciclon`: las sillas voladoras. A/D: inclinarte hacia adentro o hacia afuera; E agarra el banderín cuando
 *    pasas al lado.
 *  - `teleferico` / `rueda` / `torre`: fotos del paisaje. A/D (y W/S) mueven el visor; E saca la foto. En la
 *    Rueda, F: selfie con Flor (cuando te mira).
 */

export type ParqueMode = 'rapidos' | 'fabulas' | 'tren' | 'show' | 'ciclon' | 'teleferico' | 'rueda' | 'torre';

export interface ParqueSceneData {
  mode: ParqueMode;
  done: (r: AtraccionResult) => void;
}

const SKIN = 0xf0c8a0;
const INK = 0x2a2433;

// ---------------------------------------------------------------------------
// Rápidos
// ---------------------------------------------------------------------------

type RiverKind = 'roca' | 'cascada' | 'chorro' | 'ola';
interface RiverThing {
  kind: RiverKind;
  /** Distancia río abajo (px) y x en pantalla. */
  d: number;
  x: number;
  /** Cascada: de qué orilla cae (-1 izquierda, 1 derecha). */
  side?: number;
  done?: boolean;
}

const RIVER_LEN = 2700;
const RIVER_SPEED = 62;
const RAFT_Y = 128;
const SEATS = [
  { name: 'Tú', color: 0x2c64c0, hair: 0x3a2418 },
  { name: 'Renzo', color: 0xe8742c, hair: 0x1c1418 },
  { name: 'Juanpa', color: 0x2c9c58, hair: 0x1c1418 },
  { name: 'La señora', color: 0x8c5cc8, hair: 0x8c8c98 },
];

function riverBanks(d: number): [number, number] {
  const c = 160 + Math.sin(d / 240) * 26 + Math.sin(d / 97) * 8;
  const w = 104 + Math.sin(d / 170) * 14;
  return [c - w / 2, c + w / 2];
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

interface PhotoTarget {
  id: string;
  name: string;
  /** Posición en el panorama (px); `move` la cambia con el tiempo. */
  x: number;
  y: number;
  /** Solo se ve desde esta altura (Rueda: 0..1). */
  minH?: number;
  move?: (t: number) => [number, number];
  draw: (g: Phaser.GameObjects.Graphics, x: number, y: number, t: number) => void;
}

const PANO_W = 960;

const drawRueda = (g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void => {
  g.lineStyle(1, 0xe8e8f0, 1).strokeCircle(x, y, 22);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + t * 0.15;
    g.lineBetween(x, y, x + Math.cos(a) * 22, y + Math.sin(a) * 22);
    g.fillStyle([0xe8303c, 0xf8e070, 0x2c9cd8, 0x48b860, 0xe868a8][k % 5], 1).fillRect(x + Math.cos(a) * 22 - 2, y + Math.sin(a) * 22, 4, 4);
  }
  g.fillStyle(0x8c8c98, 1).fillTriangle(x - 12, y + 36, x, y, x + 12, y + 36);
};
const drawKraterMini = (g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void => {
  g.fillStyle(0x6a4a3a, 1).fillTriangle(x - 34, y + 20, x, y - 16, x + 34, y + 20);
  g.fillStyle(0xe8501c, 0.8).fillEllipse(x, y - 14, 18, 4);
  g.lineStyle(2, 0xd8303c, 1);
  g.beginPath();
  for (let i = 0; i <= 30; i++) {
    const px = x - 50 + i * 3.4;
    const py = y + 10 - Math.abs(Math.sin(i / 4)) * 22;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
  const c = (t * 0.25) % 1;
  g.fillStyle(0xf8e070, 1).fillRect(x - 50 + c * 100, y + 6 - Math.abs(Math.sin(c * 7.5)) * 22, 4, 3);
};
const drawBarcoMini = (g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void => {
  g.fillStyle(0x8c8c98, 1).fillRect(x - 14, y - 22, 2, 24).fillRect(x + 12, y - 22, 2, 24).fillRect(x - 14, y - 22, 28, 2);
  const a = Math.sin(t * 1.8) * 0.9;
  const bx = x + Math.sin(a) * 18;
  const by = y - 22 + Math.cos(a) * 18;
  g.lineStyle(1, 0x5a5a68, 1).lineBetween(x, y - 22, bx, by);
  g.fillStyle(0x8c4c24, 1).fillRect(bx - 10, by - 2, 20, 6);
  g.fillStyle(0xe8b828, 1).fillRect(bx - 10, by - 2, 20, 1);
};
const drawNevado = (g: Phaser.GameObjects.Graphics, x: number, y: number): void => {
  g.fillStyle(0x8ca4c0, 1).fillTriangle(x - 60, y + 30, x, y - 22, x + 60, y + 30);
  g.fillStyle(0xf8f8fc, 1).fillTriangle(x - 18, y - 6, x, y - 22, x + 18, y - 6);
  g.fillStyle(0xf8f8fc, 1).fillTriangle(x - 18, y - 6, x - 8, y - 1, x, y - 6).fillTriangle(x, y - 6, x + 9, y - 1, x + 18, y - 6);
};
const drawCafetalMini = (g: Phaser.GameObjects.Graphics, x: number, y: number): void => {
  g.fillStyle(0x5c9c4c, 1).fillEllipse(x, y, 90, 34);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 8; k++) g.fillStyle(0x2c6c2c, 1).fillCircle(x - 36 + k * 10 + (r % 2) * 5, y - 10 + r * 5, 2.5);
  g.fillStyle(0xd8303c, 1).fillRect(x - 6, y - 4, 2, 2).fillRect(x + 14, y + 2, 2, 2);
};
const drawTrenMini = (g: Phaser.GameObjects.Graphics, x: number, y: number): void => {
  g.fillStyle(0x3a3a48, 1).fillRect(x - 30, y + 4, 62, 1);
  g.fillStyle(0xc8303c, 1).fillRect(x + 12, y - 4, 12, 8);
  g.fillStyle(0x1c1824, 1).fillRect(x + 20, y - 8, 3, 4);
  for (let k = 0; k < 3; k++) g.fillStyle(0x8c5c34, 1).fillRect(x - 28 + k * 13, y - 3, 11, 7);
  g.fillStyle(0xf0f0f0, 0.7).fillCircle(x + 22, y - 12, 3);
};
const drawPajaro = (g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void => {
  const flap = Math.sin(t * 12) > 0 ? -2 : 1;
  g.fillStyle(0x2c9c78, 1).fillRect(x - 2, y - 1, 5, 3);
  g.fillStyle(0x1c6c9c, 1).fillTriangle(x - 5, y + flap, x, y, x - 1, y + 1).fillTriangle(x + 5, y + flap, x + 1, y, x + 2, y + 1);
  g.fillStyle(0x1c6c9c, 1).fillRect(x - 6, y, 3, 1);
};
const drawCabina = (g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void => {
  g.lineStyle(1, 0x3a3a48, 1).lineBetween(x, y - 10, x, y - 4);
  g.fillStyle(0xf8d030, 1).fillRoundedRect(x - 6, y - 4, 12, 10, 2);
  g.fillStyle(0x8cc4e8, 1).fillRect(x - 4, y - 2, 8, 4);
  if (Math.sin(t * 6) > 0) g.fillStyle(SKIN, 1).fillRect(x + 1, y - 3, 1, 2);
};
const drawChiva = (g: Phaser.GameObjects.Graphics, x: number, y: number): void => {
  g.fillStyle(0xf8d030, 1).fillRect(x - 10, y - 6, 20, 8);
  g.fillStyle(0xe8303c, 1).fillRect(x - 10, y - 4, 20, 1);
  g.fillStyle(0x2c9cd8, 1).fillRect(x - 10, y - 2, 20, 1);
  g.fillStyle(0x1c1824, 1).fillCircle(x - 6, y + 3, 2).fillCircle(x + 6, y + 3, 2);
};
const drawRio = (g: Phaser.GameObjects.Graphics, x: number, y: number, t: number): void => {
  g.fillStyle(0x6a8ca0, 1).fillEllipse(x, y, 140, 12);
  for (let k = 0; k < 6; k++) g.fillStyle(0xd8ecf4, 1).fillRect(x - 60 + ((k * 23 + t * 14) % 120), y - 2 + (k % 3), 6, 1);
};
const drawSol = (g: Phaser.GameObjects.Graphics, x: number, y: number): void => {
  g.fillStyle(0xf8a040, 0.4).fillCircle(x, y, 18);
  g.fillStyle(0xf8c860, 1).fillCircle(x, y, 11);
};

function photoTargets(mode: ParqueMode): PhotoTarget[] {
  if (mode === 'teleferico') {
    return [
      { id: 'rio', name: 'el río del cañón', x: 300, y: 150, draw: drawRio },
      { id: 'tren', name: 'el Tren del Café', x: 0, y: 136, move: (t) => [120 + ((t * 26) % 700), 136], draw: drawTrenMini },
      { id: 'krater', name: 'el Krater', x: 720, y: 110, draw: drawKraterMini },
      { id: 'rueda', name: 'la Rueda', x: 880, y: 96, draw: drawRueda },
      { id: 'cabina', name: 'la otra cabina (saludan)', x: 0, y: 60, move: (t) => [820 - t * 22, 52 + t * 0.6], draw: drawCabina },
      { id: 'pajaro', name: 'un barranquero', x: 0, y: 0, move: (t) => [460 + Math.sin(t * 0.5) * 140, 104 + Math.sin(t * 1.3) * 10], draw: drawPajaro },
    ];
  }
  if (mode === 'rueda') {
    return [
      { id: 'nevado', name: 'el Nevado del Ruiz', x: 780, y: 62, minH: 0.72, draw: (g, x, y) => drawNevado(g, x, y) },
      { id: 'sol', name: 'el atardecer', x: 600, y: 70, minH: 0.5, draw: (g, x, y) => drawSol(g, x, y) },
      { id: 'krater', name: 'el Krater', x: 200, y: 128, minH: 0.25, draw: drawKraterMini },
      { id: 'barco', name: 'el Barco del Café', x: 420, y: 132, minH: 0.2, draw: drawBarcoMini },
      { id: 'chiva', name: 'la chiva en la carretera', x: 0, y: 0, minH: 0.4, move: (t) => [520 + ((t * 18) % 380), 112], draw: (g, x, y) => drawChiva(g, x, y) },
      { id: 'cafetal', name: 'los cafetales', x: 90, y: 104, minH: 0.35, draw: (g, x, y) => drawCafetalMini(g, x, y) },
    ];
  }
  return [
    { id: 'nevado', name: 'el Nevado del Ruiz', x: 820, y: 60, draw: (g, x, y) => drawNevado(g, x, y) },
    { id: 'cafetal', name: 'los cafetales en terrazas', x: 120, y: 120, draw: (g, x, y) => drawCafetalMini(g, x, y) },
    { id: 'teleferico', name: 'el teleférico', x: 0, y: 0, move: (t) => [340 + ((t * 16) % 220), 86 + ((t * 16) % 220) * 0.12], draw: drawCabina },
    { id: 'krater', name: 'el Krater', x: 600, y: 130, draw: drawKraterMini },
    { id: 'barco', name: 'el Barco del Café', x: 470, y: 138, draw: drawBarcoMini },
    { id: 'rueda', name: 'la Rueda', x: 700, y: 118, draw: drawRueda },
  ];
}

// ---------------------------------------------------------------------------
// Tren
// ---------------------------------------------------------------------------

type TrenKind = 'saludo' | 'pite' | 'vaca';
interface TrenThing {
  kind: TrenKind;
  x: number;
  who: string;
  state: 'wait' | 'ok' | 'miss';
}

const TREN_SPEED = 70;
const WINDOW = { x0: 132, x1: 196 };

// ---------------------------------------------------------------------------
// Show
// ---------------------------------------------------------------------------

type ShowKey = 'left' | 'right' | 'interact';
interface ShowNote {
  t: number;
  key: ShowKey;
  state: 'wait' | 'hit' | 'miss';
}

const SHOW_BARS: ShowKey[][] = [
  ['left', 'right', 'left'],
  ['right', 'left', 'right'],
  ['left', 'right', 'left'],
  ['right', 'left', 'interact'],
];
const HIT_X = 64;

// ---------------------------------------------------------------------------
// Fábulas
// ---------------------------------------------------------------------------

interface Boat {
  name: string;
  x: number;
  y: number;
  a: number;
  v: number;
  color: number;
  cool: number;
  wet: number;
  tx: number;
  ty: number;
}
interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  from: number;
  /** Chorro al que pertenece (un chorro moja una sola vez). */
  burst: number;
}
interface Duck {
  x: number;
  y: number;
  a: number;
  real: boolean;
  quack: number;
}

const LAKE = { x: 24, y: 24, w: 272, h: 138 };
const ISLA = { x: 160, y: 93, r: 18 };

export class ParqueScene extends MiniScene<AtraccionResult> {
  private mode: ParqueMode = 'rapidos';
  private phase: 'intro' | 'play' | 'end' = 'intro';
  private score = 0;
  private skipped = false;
  private elapsed = 0;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  /** Fotos: la lista de lo que falta (con ✓ lo que ya está). */
  private listText: Phaser.GameObjects.Text | null = null;
  private flash = 0;

  // Rápidos
  private dist = 0;
  private rx = 160;
  private rvx = 0;
  private rot = 0;
  private spin = 0.6;
  private spinCool = 0;
  private wet = [0, 0, 0, 0];
  private river: RiverThing[] = [];

  // Fábulas
  private boats: Boat[] = [];
  private drops: Drop[] = [];
  private ducks: Duck[] = [];
  private shootCool = 0;
  private duckHits = 0;
  private burstId = 0;
  private spentBursts = new Set<number>();

  // Tren
  private trenX = 0;
  private tren: TrenThing[] = [];
  private stopMs = 0;
  private waveMs = 0;

  // Show
  private notes: ShowNote[] = [];
  private showT = 0;
  private stepSide = 0;
  private spinMs = 0;
  private combo = 0;

  // Ciclón
  private omega = 0;
  private theta = 0;
  private lean = 0;
  private flags: Array<{ a: number; r: number; color: number; got: number }> = [];
  /** Después de un manotazo al aire, un ratito sin poder agarrar. */
  private grabCool = 0;

  // Fotos
  private targets: PhotoTarget[] = [];
  private panX = 0;
  private panY = 0;
  private taken: string[] = [];
  private height = 0;
  private selfie = false;
  private florLook = 0;
  private rideMs = 30000;

  constructor() {
    super('Parque');
  }

  init(data: ParqueSceneData): void {
    this.initMini(data.done);
    this.mode = data.mode;
    this.phase = 'intro';
    this.score = 0;
    this.skipped = false;
    this.elapsed = 0;
    this.flash = 0;
    this.dist = 0;
    this.rx = 160;
    this.rvx = 0;
    this.rot = 0;
    this.spin = 0.6;
    this.spinCool = 0;
    this.wet = [0, 0, 0, 0];
    this.drops = [];
    this.shootCool = 0;
    this.duckHits = 0;
    this.burstId = 0;
    this.spentBursts = new Set();
    this.trenX = 0;
    this.stopMs = 0;
    this.waveMs = 0;
    this.showT = 0;
    this.stepSide = 0;
    this.spinMs = 0;
    this.combo = 0;
    this.omega = 0;
    this.theta = 0;
    this.lean = 0;
    this.grabCool = 0;
    this.panX = 0;
    this.panY = 0;
    this.taken = [];
    this.height = 0;
    this.selfie = false;
    this.florLook = 0;
  }

  create(): void {
    this.g = this.add.graphics();
    this.hud = this.add.graphics().setDepth(40);
    const bg: Record<ParqueMode, string> = {
      rapidos: '#4c8c3c',
      fabulas: '#3c7cb0',
      tren: '#9cd0f0',
      show: '#3a2c20',
      ciclon: '#7cb85c',
      teleferico: '#9cd0f0',
      rueda: '#f0b880',
      torre: '#9cd0f0',
    };
    this.createUi(bg[this.mode]);
    this.infoText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);
    this.promptText = this.addText(BASE_WIDTH / 2, 28, '', { fontSize: '10px', fontStyle: '600', color: '#f8e070', stroke: '#2a2433', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(52);
    playMusic(this.mode === 'show' ? 'salento' : this.mode === 'rueda' ? 'recuerdo' : 'parque');
    const intro: Record<ParqueMode, [string, string, string]> = {
      rapidos: [
        'Los Rápidos · Parque del Café',
        'A/D: llevar el bote · E: girar el bote · Esc: bajarte',
        'Un bote redondo para cuatro: tú, Renzo, Juanpa y una señora de Pereira.\nLas cascadas y los chorros mojan sobre todo al que va mirando hacia ellos.\nEsquívalos con A/D... o gira el bote con E para que le caigan a otro.\nRenzo: «Yo nunca me mojo, causa. Es un don.»\n(E para zarpar)',
      ],
      fabulas: [
        'Lago de Fábulas · Parque del Café',
        'W: avanzar · A/D: girar · E: cañón de agua · Esc: bajarte',
        'Botes chocones con cañón de agua. Moja a los otros botes (E).\nA los patos de plástico, lo que quieras. A los de verdad, NO.\nFlor: «¡El que quede más seco gana! ...O el que moje más. No sé, ¡dale!»\n(E para arrancar)',
      ],
      tren: [
        'Tren del Café · Estación Armenia',
        'E: saludar · F: pitar · Esc: bajarte',
        'El trencito de madera da la vuelta al parque.\nCuando pase alguien saludando frente a tu ventana: E.\nEn los letreros de «PITE» (y si hay una vaca en la vía): F.\n(E para que arranque)',
      ],
      show: [
        'Show del Café · Pasillo',
        'A/D: los pasos · E: la vuelta · Esc: volver a tu silla',
        'La bailarina te enseña: «Es un pasillo, mijo: un, dos, tres; un, dos, tres.\nPie izquierdo (A), pie derecho (D)... y cuando yo le diga, la vuelta (E).»\nAprieta cuando el paso llegue a la marca.\n(E para empezar)',
      ],
      ciclon: [
        'Ciclón · Sillas voladoras',
        'A/D: inclinarte adentro / afuera · E: agarrar el banderín · Esc: bajarte',
        'Las sillas voladoras giran cada vez más rápido.\nAlrededor hay banderines colgando: inclínate (A adentro, D afuera)\npara pasar justo al lado y agárralos con E.\nFlor, en la silla de atrás: «¡Si agarrás diez te invito un cholado!»\n(E para que arranque)',
      ],
      teleferico: [
        'Teleférico · Parque del Café',
        'A/D/W/S: mover el visor · E: sacar la foto · Esc: guardar el celular',
        'La cabina cruza el cañón. Saca fotos con el celular:\nel río, el Tren del Café, el Krater, la Rueda, la otra cabina... y un pájaro.\nPon lo que quieras dentro del visor y aprieta E.\n(E para sacar el celular)',
      ],
      rueda: [
        'Rueda Panorámica · Cabina siete',
        'A/D/W/S: mover el visor · E: foto · F: selfie con Flor · Esc: guardar el celular',
        'La rueda sube despacito. Mientras más alto, más se ve.\nSaca fotos (E) y, si Flor te mira, una selfie con ella (F).\nFlor: «¿Me vas a sacar una foto o al paisaje? Decidite.»\n(E para sacar el celular)',
      ],
      torre: [
        'Torre Mirador · Parque del Café',
        'A/D/W/S: mover el visor · E: sacar la foto · Esc: bajar',
        'Desde arriba se ve todo el parque.\nBusca el Nevado del Ruiz, los cafetales, el teleférico, el Krater, el Barco y la Rueda.\n(E para sacar el celular)',
      ],
    };
    const [title, hint, text] = intro[this.mode];
    this.titleText.setText(title);
    this.hintText.setText(hint);
    this.banner(text);
    if (this.mode === 'rapidos') this.setupRiver();
    if (this.mode === 'fabulas') this.setupLake();
    if (this.mode === 'tren') this.setupTren();
    if (this.mode === 'show') this.setupShow();
    if (this.mode === 'ciclon') this.setupCiclon();
    if (this.mode === 'teleferico' || this.mode === 'rueda' || this.mode === 'torre') {
      this.setupFotos();
      this.listText = this.addText(6, 17, '', { fontSize: '7px', color: '#fbf6ee', backgroundColor: '#0c1020aa', padding: { x: 3, y: 2 }, lineSpacing: 1 }).setDepth(50);
    } else this.listText = null;
  }

  override update(_t: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    const dt = Math.min(delta, 40) / 1000;
    if (this.phase === 'intro') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        this.phase = 'play';
      } else if (Controls.consume('menu')) this.skip();
    } else if (this.phase === 'play') {
      this.elapsed += dt;
      if (Controls.consume('menu')) this.skip();
      else if (this.mode === 'rapidos') this.rapidos(dt);
      else if (this.mode === 'fabulas') this.fabulas(dt);
      else if (this.mode === 'tren') this.trenTick(dt);
      else if (this.mode === 'show') this.show(dt);
      else if (this.mode === 'ciclon') this.ciclon(dt);
      else this.fotos(dt);
    } else if (this.phase === 'end') {
      if (Controls.consume('interact')) this.finish(this.result());
    }
    this.flash = Math.max(0, this.flash - dt * 5);
    this.draw();
  }

  private skip(): void {
    this.skipped = true;
    this.phase = 'end';
    this.promptText.setText('');
    this.banner('Te bajaste. Nadie dice nada. Todos lo piensan.\n(E para seguir)');
  }

  private end(text: string): void {
    this.phase = 'end';
    this.promptText.setText('');
    this.banner(`${text}\n(E para seguir)`);
  }

  private result(): AtraccionResult {
    const r: AtraccionResult = { mode: this.mode, score: this.score, good: false, skipped: this.skipped };
    if (this.skipped) return r;
    if (this.mode === 'rapidos') {
      r.wet = Math.round(this.wet[0]);
      r.renzoWet = this.wet[1] >= 50;
      r.good = this.wet[0] < 50;
    } else if (this.mode === 'fabulas') r.good = this.score >= 6;
    else if (this.mode === 'tren') r.good = this.score >= Math.ceil(this.tren.length * 0.7);
    else if (this.mode === 'show') r.good = this.score >= Math.ceil(this.notes.length * 0.7);
    else if (this.mode === 'ciclon') r.good = this.score >= 8;
    else {
      r.photos = [...this.taken];
      r.good = this.taken.length >= this.targets.length;
      r.selfie = this.selfie;
    }
    return r;
  }

  // -------------------------------------------------------------------------
  // Rápidos
  // -------------------------------------------------------------------------

  private setupRiver(): void {
    const kinds: RiverKind[] = ['roca', 'roca', 'cascada', 'roca', 'chorro', 'ola', 'roca', 'cascada', 'chorro', 'roca', 'ola', 'cascada', 'roca', 'chorro', 'roca', 'cascada', 'ola', 'roca', 'chorro', 'cascada'];
    this.river = [];
    let d = 260;
    let i = 0;
    while (d < RIVER_LEN - 160) {
      const kind = kinds[i % kinds.length];
      const [l, r] = riverBanks(d);
      const x = kind === 'roca' ? l + 16 + Math.random() * (r - l - 32) : kind === 'chorro' ? l + 24 + Math.random() * (r - l - 48) : (l + r) / 2;
      this.river.push({ kind, d, x, side: Math.random() < 0.5 ? -1 : 1 });
      if (kind === 'roca' && Math.random() < 0.5) this.river.push({ kind: 'roca', d: d + 30, x: l + 16 + Math.random() * (r - l - 32) });
      d += 90 + Math.random() * 50;
      i++;
    }
  }

  /** Le cae agua al bote desde el ángulo `from`: el que va mirando hacia allá se lleva casi todo. */
  private soak(from: number, big: number, rest: number): void {
    let best = 0;
    let bestD = 99;
    for (let k = 0; k < 4; k++) {
      const d = Math.abs(Phaser.Math.Angle.Wrap(this.rot + (k * Math.PI) / 2 - from));
      if (d < bestD) (bestD = d), (best = k);
    }
    for (let k = 0; k < 4; k++) this.wet[k] = Math.min(100, this.wet[k] + (k === best ? big : rest));
    const who = SEATS[best].name;
    if (best === 0) this.float('¡Te empapaste!', '#9cd8ff', this.rx, RAFT_Y - 24);
    else if (best === 1) this.float('¡A RENZO! ¡POR FIN!', '#f8e070', this.rx, RAFT_Y - 24);
    else if (best === 3) this.float('¡A la señora! «¡Ay, joven!»', '#9cd8ff', this.rx, RAFT_Y - 24);
    else this.float(`¡${who} empapado!`, '#9cd8ff', this.rx, RAFT_Y - 24);
    playSfx('chapuzon');
  }

  private rapidos(dt: number): void {
    this.dist += RIVER_SPEED * dt;
    // Remar de costado (con inercia) y la corriente que te lleva al centro.
    const push = (Controls.isHeld('left') ? -1 : 0) + (Controls.isHeld('right') ? 1 : 0);
    this.rvx += push * 150 * dt;
    const [l, r] = riverBanks(this.dist + (BASE_HEIGHT - RAFT_Y));
    this.rvx += ((l + r) / 2 - this.rx) * 0.4 * dt;
    this.rvx *= 0.96;
    this.rx += this.rvx * dt;
    if (this.rx < l + 13) (this.rx = l + 13), (this.rvx = Math.abs(this.rvx) * 0.5), (this.spin += 1.5), playSfx('golpe');
    if (this.rx > r - 13) (this.rx = r - 13), (this.rvx = -Math.abs(this.rvx) * 0.5), (this.spin -= 1.5), playSfx('golpe');
    // Girar el bote.
    this.spinCool = Math.max(0, this.spinCool - dt);
    if (Controls.consume('interact') && this.spinCool <= 0) {
      this.spin += 4.2;
      this.spinCool = 0.5;
      playSfx('splash');
    }
    this.spin += (0.6 - this.spin) * Math.min(1, dt * 1.6);
    this.rot += this.spin * dt;
    // Lo que viene río abajo.
    for (const o of this.river) {
      if (o.done) continue;
      const sy = RAFT_Y - (o.d - this.dist - (BASE_HEIGHT - RAFT_Y));
      if (o.kind === 'roca') {
        if (Math.hypot(o.x - this.rx, sy - RAFT_Y) < 19) {
          o.done = true;
          this.rvx += (this.rx - o.x) * 6;
          this.spin += (Math.random() < 0.5 ? -1 : 1) * 5;
          this.cameras.main.shake(140, 0.006);
          playSfx('golpe');
          this.soak(Math.atan2(sy - RAFT_Y, o.x - this.rx), 6, 1);
        }
      } else if (o.kind === 'cascada') {
        // Cae de una orilla y tapa 60 % del río.
        if (Math.abs(sy - RAFT_Y) < 8) {
          o.done = true;
          const [bl, br] = riverBanks(o.d);
          const reach = (br - bl) * 0.6;
          const inside = o.side! < 0 ? this.rx < bl + reach : this.rx > br - reach;
          if (inside) this.soak(o.side! < 0 ? Math.PI : 0, 40, 8);
          else this.float('¡Esquivada!', '#a8e0a0', this.rx, RAFT_Y - 24), (this.score += 1);
        }
      } else if (o.kind === 'chorro') {
        const on = Math.sin(this.elapsed * 4 + o.d) > 0.2;
        if (on && !o.done && Math.hypot(o.x - this.rx, sy - RAFT_Y) < 20) {
          o.done = true;
          this.soak(Math.atan2(sy - RAFT_Y, o.x - this.rx), 25, 4);
        }
        if (sy > RAFT_Y + 24) o.done = true;
      } else if (o.kind === 'ola' && Math.abs(sy - RAFT_Y) < 6) {
        o.done = true;
        this.spin += 3;
        this.cameras.main.shake(200, 0.008);
        for (let k = 0; k < 4; k++) this.wet[k] = Math.min(100, this.wet[k] + 4);
        this.float('¡OLA!', '#dfe6f4', this.rx, RAFT_Y - 24);
        playSfx('splash');
      }
    }
    if (this.dist >= RIVER_LEN) {
      const me = Math.round(this.wet[0]);
      const renzo = this.wet[1] >= 50 ? '\nRenzo sale empapado. Mira el cielo. «Causa... ¿qué hiciste?» Es la primera vez en la historia.' : '\nRenzo sale seco. Seco. No hay explicación científica.';
      const verdict = me < 25 ? 'Sales casi seco. Juanpa: «¡Parce, usted es un capitán!»' : me < 60 ? 'Sales mojado, pero digno.' : 'Sales empapado de pies a cabeza. Exprimes la camiseta.';
      this.score = 100 - me;
      this.end(`Los Rápidos: mojado ${me}%.\n${verdict}${renzo}`);
    }
  }

  private drawRapidos(g: Phaser.GameObjects.Graphics): void {
    const H = BASE_HEIGHT;
    g.fillStyle(0x4c8c3c, 1).fillRect(0, 0, BASE_WIDTH, H);
    // El río fila por fila.
    for (let y = 0; y < H; y += 2) {
      const d = this.dist + (H - y);
      const [l, r] = riverBanks(d);
      g.fillStyle(0x8c7c64, 1).fillRect(l - 6, y, r - l + 12, 2);
      g.fillStyle(0x3c8cc0, 1).fillRect(l, y, r - l, 2);
      if (((d | 0) % 22) < 2) g.fillStyle(0x9cd0f0, 0.8).fillRect(l + ((d * 7) % (r - l - 10)), y, 8, 1);
    }
    // Guaduas en las orillas.
    for (let k = 0; k < 10; k++) {
      const d = Math.floor(this.dist / 60) * 60 + k * 60 - 60;
      const y = H - (d - this.dist);
      const [l, r] = riverBanks(d);
      g.fillStyle(0x2c6c2c, 1).fillCircle(l - 18 - (k % 3) * 8, y, 9).fillCircle(r + 18 + (k % 2) * 10, y + 20, 10);
      g.fillStyle(0x8cb848, 1).fillRect(l - 30, y - 12, 2, 18).fillRect(r + 30, y + 6, 2, 18);
    }
    for (const o of this.river) {
      const sy = RAFT_Y - (o.d - this.dist - (H - RAFT_Y));
      if (sy < -30 || sy > H + 30) continue;
      if (o.kind === 'roca') {
        g.fillStyle(INK, 1).fillCircle(o.x, sy, 8);
        g.fillStyle(0x8c8c98, 1).fillCircle(o.x, sy, 7);
        g.fillStyle(0xb0b0bc, 1).fillCircle(o.x - 2, sy - 2, 3);
        g.fillStyle(0xffffff, 0.7).fillRect(o.x - 9, sy + 6, 18, 1);
      } else if (o.kind === 'cascada') {
        const [bl, br] = riverBanks(o.d);
        const reach = (br - bl) * 0.6;
        const x0 = o.side! < 0 ? bl - 10 : br - reach;
        const x1 = o.side! < 0 ? bl + reach : br + 10;
        g.fillStyle(0x5a4a3a, 1).fillRect(o.side! < 0 ? bl - 22 : br + 4, sy - 12, 18, 18);
        for (let x = x0; x < x1; x += 3) g.fillStyle(0xd8f0ff, 0.55 + 0.3 * Math.sin(x + this.elapsed * 20)).fillRect(x, sy - 6, 2, 12);
        if (sy < RAFT_Y - 20) g.fillStyle(0xf8e070, 1).fillRect((x0 + x1) / 2 - 1, sy - 16, 2, 5).fillRect((x0 + x1) / 2 - 1, sy - 9, 2, 2);
      } else if (o.kind === 'chorro') {
        const on = Math.sin(this.elapsed * 4 + o.d) > 0.2;
        g.fillStyle(0x2a6c9c, 1).fillCircle(o.x, sy, 5);
        if (on) for (let k = 0; k < 5; k++) g.fillStyle(0xe8f8ff, 0.8).fillCircle(o.x + Math.sin(k * 2 + this.elapsed * 10) * 4, sy - k * 3, 3 - k * 0.4);
      } else {
        const [bl, br] = riverBanks(o.d);
        for (let x = bl; x < br; x += 6) g.fillStyle(0xf4fbff, 0.8).fillRect(x, sy + Math.sin(x / 8 + this.elapsed * 6) * 2, 4, 2);
      }
    }
    // El bote y sus cuatro: el que mira hacia arriba es el que se moja con lo que viene.
    g.fillStyle(INK, 1).fillCircle(this.rx, RAFT_Y, 14);
    g.fillStyle(0xe8b828, 1).fillCircle(this.rx, RAFT_Y, 13);
    g.fillStyle(0x3a3a48, 1).fillCircle(this.rx, RAFT_Y, 8);
    for (let k = 0; k < 4; k++) {
      const a = this.rot + (k * Math.PI) / 2;
      const sx = this.rx + Math.cos(a) * 8;
      const sy = RAFT_Y + Math.sin(a) * 8;
      g.fillStyle(SEATS[k].color, 1).fillCircle(sx, sy, 4);
      g.fillStyle(SEATS[k].hair, 1).fillCircle(sx - Math.cos(a), sy - Math.sin(a), 2.5);
      if (this.wet[k] > 30) g.fillStyle(0x9cd8ff, 0.8).fillRect(sx - 1, sy + 3, 1, 2);
    }
    const me = this.rot;
    g.fillStyle(0xffffff, 1).fillTriangle(this.rx + Math.cos(me) * 17 - 2, RAFT_Y + Math.sin(me) * 17, this.rx + Math.cos(me) * 17 + 2, RAFT_Y + Math.sin(me) * 17, this.rx + Math.cos(me) * 21, RAFT_Y + Math.sin(me) * 21);
  }

  // -------------------------------------------------------------------------
  // Lago de Fábulas
  // -------------------------------------------------------------------------

  private setupLake(): void {
    const mk = (name: string, x: number, y: number, a: number, color: number): Boat => ({ name, x, y, a, v: 0, color, cool: 1 + Math.random(), wet: 0, tx: x, ty: y });
    this.boats = [
      mk('Tú', 60, 140, -Math.PI / 2, 0x2c64c0),
      mk('Flor', 260, 50, Math.PI, 0xe868a8),
      mk('Meli', 260, 140, Math.PI, 0xf8dc68),
      mk('Juanpa', 60, 46, 0, 0x2c9c58),
      mk('Renzo', 160, 150, -Math.PI / 2, 0xe8742c),
    ];
    this.ducks = [];
    for (let i = 0; i < 7; i++) {
      this.ducks.push({ x: LAKE.x + 20 + Math.random() * (LAKE.w - 40), y: LAKE.y + 16 + Math.random() * (LAKE.h - 32), a: Math.random() * Math.PI * 2, real: i < 3, quack: 0 });
    }
  }

  private shoot(b: Boat, from: number): void {
    const burst = ++this.burstId;
    for (let k = 0; k < 6; k++) {
      const a = b.a + (Math.random() - 0.5) * 0.18;
      const sp = 150 + k * 6;
      this.drops.push({ x: b.x + Math.cos(b.a) * 9, y: b.y + Math.sin(b.a) * 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.42 - k * 0.02, from, burst });
    }
    playSfx('splash');
  }

  private fabulas(dt: number): void {
    const me = this.boats[0];
    if (Controls.isHeld('left')) me.a -= 2.6 * dt;
    if (Controls.isHeld('right')) me.a += 2.6 * dt;
    if (Controls.isHeld('up')) me.v = Math.min(60, me.v + 70 * dt);
    else if (Controls.isHeld('down')) me.v = Math.max(-25, me.v - 70 * dt);
    else me.v *= 0.985;
    this.shootCool = Math.max(0, this.shootCool - dt);
    if (Controls.consume('interact') && this.shootCool <= 0) {
      this.shootCool = 0.45;
      this.shoot(me, 0);
    }
    // Los demás: pasean, persiguen y disparan cuando apuntan a alguien.
    for (let i = 1; i < this.boats.length; i++) {
      const b = this.boats[i];
      b.cool -= dt;
      if (Math.hypot(b.tx - b.x, b.ty - b.y) < 14 || Math.random() < dt * 0.3) {
        const chase = Math.random() < 0.5;
        b.tx = chase ? me.x : LAKE.x + 20 + Math.random() * (LAKE.w - 40);
        b.ty = chase ? me.y : LAKE.y + 20 + Math.random() * (LAKE.h - 40);
      }
      const want = Math.atan2(b.ty - b.y, b.tx - b.x);
      b.a += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - b.a), -1.8 * dt, 1.8 * dt);
      b.v = Math.min(b.name === 'Renzo' ? 32 : 44, b.v + 40 * dt);
      for (let j = 0; j < this.boats.length; j++) {
        if (j === i || b.cool > 0) continue;
        const o = this.boats[j];
        const d = Math.hypot(o.x - b.x, o.y - b.y);
        if (d < 62 && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(o.y - b.y, o.x - b.x) - b.a)) < 0.3) {
          b.cool = 1.4 + Math.random() * 1.4;
          this.shoot(b, i);
        }
      }
    }
    for (const b of this.boats) {
      b.x += Math.cos(b.a) * b.v * dt;
      b.y += Math.sin(b.a) * b.v * dt;
      if (b.x < LAKE.x + 9 || b.x > LAKE.x + LAKE.w - 9) (b.a = Math.PI - b.a), (b.x = Phaser.Math.Clamp(b.x, LAKE.x + 9, LAKE.x + LAKE.w - 9)), (b.v *= 0.5);
      if (b.y < LAKE.y + 9 || b.y > LAKE.y + LAKE.h - 9) (b.a = -b.a), (b.y = Phaser.Math.Clamp(b.y, LAKE.y + 9, LAKE.y + LAKE.h - 9)), (b.v *= 0.5);
      const di = Math.hypot(b.x - ISLA.x, b.y - ISLA.y);
      if (di < ISLA.r + 9) {
        b.x = ISLA.x + ((b.x - ISLA.x) / di) * (ISLA.r + 9);
        b.y = ISLA.y + ((b.y - ISLA.y) / di) * (ISLA.r + 9);
        b.v *= 0.4;
      }
    }
    for (let i = 0; i < this.boats.length; i++) {
      for (let j = i + 1; j < this.boats.length; j++) {
        const a = this.boats[i];
        const b = this.boats[j];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d >= 16 || d === 0) continue;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= (nx * (16 - d)) / 2;
        a.y -= (ny * (16 - d)) / 2;
        b.x += (nx * (16 - d)) / 2;
        b.y += (ny * (16 - d)) / 2;
        if (a.v > 20 || b.v > 20) playSfx('chocon');
        a.v *= 0.5;
        b.v *= 0.5;
      }
    }
    // Patos.
    for (const d of this.ducks) {
      d.a += (Math.random() - 0.5) * dt * 2;
      d.x += Math.cos(d.a) * (d.real ? 10 : 3) * dt;
      d.y += Math.sin(d.a) * (d.real ? 10 : 3) * dt;
      if (d.x < LAKE.x + 6 || d.x > LAKE.x + LAKE.w - 6) d.a = Math.PI - d.a;
      if (d.y < LAKE.y + 6 || d.y > LAKE.y + LAKE.h - 6) d.a = -d.a;
      d.x = Phaser.Math.Clamp(d.x, LAKE.x + 6, LAKE.x + LAKE.w - 6);
      d.y = Phaser.Math.Clamp(d.y, LAKE.y + 6, LAKE.y + LAKE.h - 6);
      d.quack = Math.max(0, d.quack - dt);
    }
    // El agua.
    this.drops = this.drops.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) return false;
      for (let i = 0; i < this.boats.length; i++) {
        if (i === p.from) continue;
        const b = this.boats[i];
        if (Math.hypot(b.x - p.x, b.y - p.y) < 9) {
          b.wet = Math.min(100, b.wet + 3);
          // Un chorro moja (y suma) una sola vez.
          if (p.from === 0 && !this.spentBursts.has(p.burst)) {
            this.spentBursts.add(p.burst);
            this.score++;
            this.float(i === 1 ? '¡A Flor!' : '¡SPLASH!', '#9cd8ff', b.x, b.y - 12);
            if (i === 1) this.say('Flor: «¡Ah, no! ¡Esto es la guerra, chileno!»', b.x, b.y - 14, 1200);
          }
          return false;
        }
      }
      for (const d of this.ducks) {
        if (p.from === 0 && Math.hypot(d.x - p.x, d.y - p.y) < 6) {
          if (d.real && d.quack <= 0) {
            d.quack = 1.5;
            this.duckHits++;
            this.score = Math.max(0, this.score - 1);
            this.float('¡CUAC! (el pato de verdad te mira feo)', '#ff9c9c', d.x, d.y - 10);
            playSfx('error');
          } else if (!d.real) d.a += Math.PI;
          return false;
        }
      }
      return true;
    });
    if (this.elapsed >= 40) {
      const wetMe = Math.round(this.boats[0].wet);
      const patos = this.duckHits > 0 ? `\nUn señor del parque te señala los patos con cara de «a los de verdad, no».` : '';
      this.end(`¡Se acabó el tiempo! Mojaste ${this.score} veces. Te mojaron ${wetMe}%.${patos}\nFlor: «Revancha en la Rueda. Ahí no hay agua... pero algo se me ocurre.»`);
    }
  }

  private drawFabulas(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x4c8c3c, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    g.fillStyle(0x8c7c64, 1).fillRoundedRect(LAKE.x - 6, LAKE.y - 6, LAKE.w + 12, LAKE.h + 12, 14);
    g.fillStyle(0x3c7cb0, 1).fillRoundedRect(LAKE.x, LAKE.y, LAKE.w, LAKE.h, 10);
    for (let i = 0; i < 26; i++) g.fillStyle(0x6cacd8, 0.8).fillRect(LAKE.x + ((i * 53 + this.elapsed * 6) % (LAKE.w - 10)), LAKE.y + ((i * 31) % (LAKE.h - 6)), 6, 1);
    // La isla con la casita de los patos.
    g.fillStyle(0x5c9c4c, 1).fillCircle(ISLA.x, ISLA.y, ISLA.r);
    g.fillStyle(0xc8784c, 1).fillRect(ISLA.x - 6, ISLA.y - 4, 12, 9);
    g.fillStyle(0x8c3c24, 1).fillTriangle(ISLA.x - 8, ISLA.y - 4, ISLA.x + 8, ISLA.y - 4, ISLA.x, ISLA.y - 11);
    for (const d of this.ducks) {
      g.fillStyle(d.real ? 0xf4f4f0 : 0xf8dc30, 1).fillEllipse(d.x, d.y, 8, 5);
      g.fillStyle(d.real ? 0x2c7c48 : 0xf8dc30, 1).fillCircle(d.x + Math.cos(d.a) * 3, d.y + Math.sin(d.a) * 3 - 1, 2);
      g.fillStyle(0xe8901c, 1).fillRect(d.x + Math.cos(d.a) * 5, d.y + Math.sin(d.a) * 5 - 1, 2, 1);
    }
    for (const b of this.boats) {
      g.fillStyle(INK, 1).fillCircle(b.x, b.y, 10);
      g.fillStyle(b.color, 1).fillCircle(b.x, b.y, 9);
      g.fillStyle(0xf4f0e6, 1).fillCircle(b.x, b.y, 5);
      g.fillStyle(0x3a3a48, 1).fillRect(b.x + Math.cos(b.a) * 6 - 1, b.y + Math.sin(b.a) * 6 - 1, 3, 3);
      g.fillStyle(0x3a2418, 1).fillCircle(b.x - Math.cos(b.a) * 1, b.y - Math.sin(b.a) * 1, 2.5);
      if (b.wet > 20) g.fillStyle(0x9cd8ff, 0.8).fillCircle(b.x + 6, b.y - 8, 1.5);
    }
    for (const p of this.drops) g.fillStyle(0xd8f0ff, 0.9).fillRect(p.x, p.y, 2, 2);
    const me = this.boats[0];
    if (me) g.fillStyle(0xffffff, 1).fillTriangle(me.x - 4, me.y - 16, me.x + 4, me.y - 16, me.x, me.y - 12);
    const flor = this.boats[1];
    if (flor) g.fillStyle(0xe868a8, 1).fillTriangle(flor.x - 3, flor.y - 16, flor.x + 3, flor.y - 16, flor.x, flor.y - 12);
  }

  // -------------------------------------------------------------------------
  // Tren del Café
  // -------------------------------------------------------------------------

  private setupTren(): void {
    const list: Array<[TrenKind, string]> = [
      ['saludo', 'Un niño en la baranda'],
      ['pite', 'PITE'],
      ['saludo', 'Una señora con sombrero aguadeño'],
      ['saludo', 'Los del Show del Café'],
      ['vaca', 'Una vaca en la vía'],
      ['pite', 'PITE (túnel)'],
      ['saludo', 'Un recolector en el cafetal'],
      ['saludo', 'Tami y Danilo'],
      ['pite', 'PITE (puente)'],
      ['saludo', 'Una niña con un algodón de azúcar'],
      ['saludo', 'Dos argentinas en la fila del Krater'],
      ['pite', 'PITE (estación)'],
    ];
    this.tren = list.map(([kind, who], i) => ({ kind, who, x: 420 + i * 270 + (i % 3) * 30, state: 'wait' }));
  }

  private trenTick(dt: number): void {
    const vaca = this.tren.find((t) => t.kind === 'vaca' && t.state === 'wait' && t.x - this.trenX < 300);
    if (this.stopMs > 0) this.stopMs -= dt * 1000;
    else this.trenX += TREN_SPEED * dt * (vaca && vaca.x - this.trenX < 230 ? 0.4 : 1);
    this.waveMs = Math.max(0, this.waveMs - dt * 1000);
    const wave = Controls.consume('interact');
    const pite = Controls.consume('trick');
    if (wave) this.waveMs = 500;
    if (pite) playSfx('train-depart');
    for (const t of this.tren) {
      if (t.state !== 'wait') continue;
      const sx = t.x - this.trenX;
      const inWin = sx > WINDOW.x0 - 10 && sx < WINDOW.x1 + 10;
      if (t.kind === 'saludo') {
        if (inWin && wave) {
          t.state = 'ok';
          this.score++;
          this.float('¡Te saludan de vuelta!', '#a8e0a0', sx, 70);
        } else if (sx < WINDOW.x0 - 14) {
          t.state = 'miss';
          this.float('...', '#ff9c9c', sx + 20, 70);
        }
      } else if (t.kind === 'pite') {
        if (inWin && pite) {
          t.state = 'ok';
          this.score++;
          this.float('¡PIIIII!', '#f8e070', sx, 50);
        } else if (sx < WINDOW.x0 - 14) t.state = 'miss';
      } else {
        // La vaca: hay que pitar antes de llegar.
        if (pite && sx < 300 && sx > WINDOW.x1) {
          t.state = 'ok';
          this.score++;
          this.float('La vaca se corre. Despacito.', '#a8e0a0', sx, 90);
        } else if (sx <= WINDOW.x1 + 4) {
          t.state = 'miss';
          this.stopMs = 3000;
          this.say('Maquinista: «¡Ay, Lucerito, otra vez! ...Esperamos, señores.»', 160, 60, 2600);
        }
      }
    }
    if (this.elapsed > 6 && this.elapsed < 6.1) this.say('Renzo: «Este sí es mi ritmo, causa.» (se duerme)', 160, 60, 2400);
    const last = this.tren[this.tren.length - 1];
    if (last.state !== 'wait' && last.x - this.trenX < -60) {
      const verdict = this.score >= this.tren.length - 1 ? '¡El maquinista te regala la gorra del tren!' : this.score >= this.tren.length / 2 ? 'El maquinista te hace un gesto de aprobación.' : 'Renzo se despierta: «¿Ya llegamos? ¿Me perdí algo?»';
      this.end(`El Tren del Café vuelve a la Estación Armenia.\nSaludos y pitazos: ${this.score}/${this.tren.length}.\n${verdict}`);
    }
  }

  private drawTren(g: Phaser.GameObjects.Graphics): void {
    const W = BASE_WIDTH;
    const cx = this.trenX;
    const inTunnel = this.tren.some((t) => t.who === 'PITE (túnel)' && t.x - cx < 120 && t.x - cx > -200);
    g.fillStyle(0x9cd0f0, 1).fillRect(0, 0, W, 120);
    for (let i = -1; i < 6; i++) {
      const x = i * 90 - ((cx * 0.2) % 90);
      g.fillStyle(0x6a9cb0, 1).fillTriangle(x - 60, 110, x, 50 + (i % 3) * 8, x + 60, 110);
    }
    for (let i = -1; i < 8; i++) {
      const x = i * 60 - ((cx * 0.5) % 60);
      g.fillStyle(0x5c9c4c, 1).fillEllipse(x + 30, 112, 90, 40);
      for (let r = 0; r < 3; r++) g.fillStyle(0x3c7c34, 1).fillRect(x + 6, 100 + r * 6, 50, 2);
    }
    g.fillStyle(0x4c8c3c, 1).fillRect(0, 118, W, 62);
    // Vía y durmientes.
    g.fillStyle(0x6a5a4a, 1).fillRect(0, 150, W, 6);
    for (let x = -((cx | 0) % 12); x < W; x += 12) g.fillStyle(0x4a3a2a, 1).fillRect(x, 152, 6, 4);
    // Lo que pasa por la ventana.
    for (const t of this.tren) {
      const sx = t.x - cx;
      if (sx < -40 || sx > W + 40) continue;
      if (t.kind === 'saludo') {
        const waving = Math.sin(this.elapsed * 10) > 0;
        g.fillStyle([0xe868a8, 0x2c9c58, 0xf8dc68, 0x8c5cc8][t.x % 4], 1).fillRect(sx - 4, 122, 8, 12);
        g.fillStyle(SKIN, 1).fillRect(sx - 3, 115, 6, 6);
        g.fillStyle(SKIN, 1).fillRect(sx + 4, waving ? 110 : 113, 2, 7);
        if (t.state === 'ok') g.fillStyle(SKIN, 1).fillRect(sx - 6, 110, 2, 7);
        if (t.state === 'wait') g.fillStyle(0xf8e070, 1).fillRect(sx - 1, 100, 3, 6).fillRect(sx - 1, 108, 3, 2);
      } else if (t.kind === 'pite') {
        g.fillStyle(0x3a3a48, 1).fillRect(sx, 120, 2, 26);
        g.fillStyle(0xf8e070, 1).fillRect(sx - 9, 112, 20, 10);
        g.fillStyle(INK, 1).fillRect(sx - 9, 112, 20, 1);
        if (t.who.includes('puente')) g.fillStyle(0x6a8ca0, 1).fillRect(sx + 20, 156, 80, 24);
        if (t.who.includes('estación')) {
          g.fillStyle(0xc8784c, 1).fillRect(sx + 30, 104, 80, 44);
          g.fillStyle(0x8c3c24, 1).fillTriangle(sx + 24, 104, sx + 116, 104, sx + 70, 88);
        }
      } else {
        g.fillStyle(0xf4f4f0, 1).fillRect(sx - 10, 136, 20, 10);
        g.fillStyle(INK, 1).fillRect(sx - 6, 138, 5, 4).fillRect(sx + 3, 140, 4, 3);
        g.fillStyle(0xf4f4f0, 1).fillRect(sx + 8, 132, 6, 6);
        g.fillStyle(0x3a3a48, 1).fillRect(sx - 8, 146, 2, 4).fillRect(sx + 6, 146, 2, 4);
      }
    }
    if (inTunnel) g.fillStyle(0x140c08, 0.85).fillRect(0, 0, W, 180);
    // El vagón por dentro (la ventana): marco de madera, Renzo durmiendo al lado.
    g.fillStyle(0x8c5c34, 1).fillRect(0, 0, W, 16).fillRect(0, 160, W, 20);
    g.fillStyle(0x6a3c1c, 1).fillRect(WINDOW.x0 - 8, 16, 4, 144).fillRect(WINDOW.x1 + 4, 16, 4, 144);
    g.lineStyle(1, 0xf8e070, this.waveMs > 0 ? 0.9 : 0.35).strokeRect(WINDOW.x0, 40, WINDOW.x1 - WINDOW.x0, 110);
    g.fillStyle(0xe8742c, 1).fillRect(24, 140, 22, 20);
    g.fillStyle(SKIN, 1).fillCircle(35, 134, 7);
    g.fillStyle(0x1c1418, 1).fillRect(28, 126, 14, 4);
    if (this.elapsed > 6) g.fillStyle(0xffffff, 0.8).fillRect(44, 122 - ((this.elapsed * 6) % 8), 3, 1);
    if (this.waveMs > 0) g.fillStyle(SKIN, 1).fillRect(WINDOW.x0 + 30, 120, 4, 20);
  }

  // -------------------------------------------------------------------------
  // Show del Café (pasillo)
  // -------------------------------------------------------------------------

  private setupShow(): void {
    this.notes = [];
    let t = 1.4;
    for (let bar = 0; bar < 24; bar++) {
      const beat = bar < 12 ? 0.46 : 0.38;
      for (const key of SHOW_BARS[bar % SHOW_BARS.length]) {
        this.notes.push({ t, key, state: 'wait' });
        t += beat;
      }
      if (bar === 11) t += 1.2;
    }
  }

  private show(dt: number): void {
    this.showT += dt;
    this.spinMs = Math.max(0, this.spinMs - dt * 1000);
    const pressed: ShowKey[] = [];
    if (Controls.consume('left')) pressed.push('left');
    if (Controls.consume('right')) pressed.push('right');
    if (Controls.consume('interact')) pressed.push('interact');
    for (const key of pressed) {
      if (key === 'left') this.stepSide = -1;
      if (key === 'right') this.stepSide = 1;
      const n = this.notes.find((nn) => nn.state === 'wait' && Math.abs(nn.t - this.showT) < 0.16);
      if (n && n.key === key) {
        n.state = 'hit';
        this.score++;
        this.combo++;
        const perfect = Math.abs(n.t - this.showT) < 0.06;
        this.float(perfect ? '¡Perfecto!' : '¡Bien!', perfect ? '#f8e070' : '#a8e0a0', HIT_X, 54);
        if (key === 'interact') {
          this.spinMs = 700;
          playSfx('select');
        }
        if (this.combo === 12) this.say('Tami: «¡ESE ES MI CHILENO!»', 250, 100, 1400);
        if (this.combo === 24) this.say('Danilo: «¡Ah ve! ¡Exposición superada, parce!»', 90, 100, 1400);
      } else if (n) {
        n.state = 'miss';
        this.combo = 0;
      }
    }
    for (const n of this.notes) {
      if (n.state === 'wait' && this.showT - n.t > 0.18) {
        n.state = 'miss';
        this.combo = 0;
      }
    }
    if (this.showT > this.notes[this.notes.length - 1].t + 1.2) {
      const pct = Math.round((this.score / this.notes.length) * 100);
      const verdict =
        pct >= 85
          ? 'La bailarina te hace una reverencia. El público aplaude de pie. Tami aplaude más fuerte que todos.'
          : pct >= 60
            ? 'Un pasillo con algo de chileno, pero pasillo al fin. Aplausos.'
            : 'Le pisaste los pies dos veces. Ella sonríe igual: «Es que el pasillo es rápido, mijo.»';
      this.end(`Pasillo: ${this.score}/${this.notes.length} pasos (${pct}%).\n${verdict}`);
    }
  }

  private drawShow(g: Phaser.GameObjects.Graphics): void {
    const W = BASE_WIDTH;
    g.fillStyle(0x3a2c20, 1).fillRect(0, 0, W, BASE_HEIGHT);
    // Tarima de guadua y el telón.
    g.fillStyle(0x8c2c24, 1).fillRect(20, 16, W - 40, 80);
    for (let x = 20; x < W - 20; x += 10) g.fillStyle(0x6a1c18, 1).fillRect(x, 16, 3, 80);
    g.fillStyle(0xb8a050, 1).fillRect(10, 96, W - 20, 30);
    for (let x = 10; x < W - 10; x += 8) g.fillStyle(0x8c7c38, 1).fillRect(x, 96, 1, 30);
    // La cinta de pasos.
    g.fillStyle(0x0c1020, 0.75).fillRect(0, 36, W, 22);
    g.lineStyle(1, 0xf8e070, 1).strokeRect(HIT_X - 9, 37, 18, 20);
    for (const n of this.notes) {
      const x = HIT_X + (n.t - this.showT) * 110;
      if (x < -10 || x > W + 10 || n.state === 'hit') continue;
      const c = n.key === 'left' ? 0x5cc8e8 : n.key === 'right' ? 0xe868a8 : 0xf8e070;
      g.fillStyle(n.state === 'miss' ? 0x5a5a68 : c, 1).fillRoundedRect(x - 7, 40, 14, 14, 3);
      g.fillStyle(INK, 1);
      if (n.key === 'left') g.fillTriangle(x + 3, 43, x + 3, 51, x - 3, 47);
      else if (n.key === 'right') g.fillTriangle(x - 3, 43, x - 3, 51, x + 3, 47);
      else g.fillCircle(x, 47, 3);
    }
    // El público: Tami, Richi y Danilo aplauden al ritmo.
    const clap = Math.floor(this.showT / 0.46) % 2 === 0;
    for (const [x, color, hair] of [[60, 0xe868a8, 0xd8b070], [90, 0x5a90e8, 0x1c1418], [120, 0x2c9c58, 0x3a2418], [200, 0xf8dc68, 0x3a2418], [240, 0x8c5cc8, 0x1c1418], [270, 0xe8742c, 0x6a3c1c]] as const) {
      g.fillStyle(color, 1).fillRect(x - 6, 150, 12, 18);
      g.fillStyle(SKIN, 1).fillCircle(x, 144, 5);
      g.fillStyle(hair, 1).fillRect(x - 5, 138, 10, 3);
      g.fillStyle(SKIN, 1).fillRect(x - (clap ? 2 : 5), 148, 2, 4).fillRect(x + (clap ? 0 : 3), 148, 2, 4);
    }
    // Tú y la bailarina (chapolera, falda de flores).
    const step = this.stepSide * 3;
    const px = 140 + step;
    g.fillStyle(0xf4f4f0, 1).fillRect(px - 5, 98, 10, 14);
    g.fillStyle(0x2a2433, 1).fillRect(px - 5, 112, 4, 12).fillRect(px + 1, 112, 4, 12);
    g.fillStyle(0xc8303c, 1).fillRect(px - 5, 98, 10, 2);
    g.fillStyle(SKIN, 1).fillCircle(px, 92, 6);
    g.fillStyle(0x3a2418, 1).fillRect(px - 6, 85, 12, 4);
    g.fillStyle(0xd8b878, 1).fillRect(px - 8, 83, 16, 2);
    const spin = this.spinMs > 0 ? Math.sin((this.spinMs / 700) * Math.PI * 2) : 1;
    const bx = 180 - step;
    const flare = this.spinMs > 0 ? 16 : 10;
    g.fillStyle(0x2c2c48, 1).fillTriangle(bx - flare * Math.abs(spin) - 2, 124, bx + flare * Math.abs(spin) + 2, 124, bx, 102);
    for (let k = -2; k <= 2; k++) g.fillStyle([0xe8303c, 0xf8e070, 0x48b860][Math.abs(k) % 3], 1).fillCircle(bx + k * 4 * Math.abs(spin), 118, 1.5);
    g.fillStyle(0xf4f4f0, 1).fillRect(bx - 4, 96, 8, 8);
    g.fillStyle(SKIN, 1).fillCircle(bx, 91, 5);
    g.fillStyle(0x1c1418, 1).fillRect(bx - 5 * spin, 85, 10 * Math.abs(spin) + 1, 4);
    g.fillStyle(0xe8303c, 1).fillCircle(bx + 4 * spin, 86, 2);
  }

  // -------------------------------------------------------------------------
  // Ciclón (sillas voladoras)
  // -------------------------------------------------------------------------

  private setupCiclon(): void {
    this.flags = [];
    for (let i = 0; i < 6; i++) this.flags.push(this.newFlag(i));
  }

  private newFlag(i: number): { a: number; r: number; color: number; got: number } {
    return { a: (i / 6) * Math.PI * 2 + Math.random() * 0.6, r: 48 + Math.random() * 38, color: [0xf8d030, 0x2c64c0, 0xc8303c][i % 3], got: 0 };
  }

  private ciclon(dt: number): void {
    const T = 42;
    const t = this.elapsed;
    const target = t < 6 ? (t / 6) * 2.3 : t > T - 5 ? Math.max(0, ((T - t) / 5) * 2.3) : 2.3 + Math.sin(t * 0.3) * 0.3;
    this.omega += (target - this.omega) * Math.min(1, dt * 2);
    this.theta += this.omega * dt;
    const want = (Controls.isHeld('right') ? 1 : 0) - (Controls.isHeld('left') ? 1 : 0);
    this.lean += (want * 14 - this.lean) * Math.min(1, dt * 5);
    const r = this.chairR(0);
    const me = { x: 160 + Math.cos(this.theta) * r, y: 92 + Math.sin(this.theta) * r * 0.62 };
    this.grabCool = Math.max(0, this.grabCool - dt);
    const grab = Controls.consume('interact') && this.grabCool <= 0;
    let got = false;
    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      if (f.got > 0) {
        f.got -= dt;
        if (f.got <= 0) this.flags[i] = this.newFlag(i);
        continue;
      }
      const fx = 160 + Math.cos(f.a) * f.r;
      const fy = 92 + Math.sin(f.a) * f.r * 0.62;
      if (grab && !got && Math.hypot(fx - me.x, (fy - me.y) / 0.62) < 8) {
        got = true;
        f.got = 1.4;
        this.score++;
        this.float(this.score === 10 ? '¡DIEZ! ¡Cholado!' : '¡Banderín!', '#f8e070', fx, fy - 10);
        playSfx('item');
        if (this.score === 10) this.say('Flor: «¡NO! ¡Ahora te debo un cholado!»', 160, 30, 1600);
      }
    }
    if (grab && !got) {
      this.grabCool = 0.8;
      this.float('Manotazo al aire.', '#ff9c9c', me.x, me.y - 12);
    }
    if (this.omega > 2 && Math.random() < dt * 0.25) this.say(Math.random() < 0.5 ? 'Flor: «¡WIIIII!»' : 'Juanpa: «¡Parce, siento el estómago en la oreja!»', 160, 30, 1100);
    if (t >= T) {
      const verdict = this.score >= 10 ? 'Flor te debe un cholado. Lo anota en la mano.' : this.score >= 6 ? 'Flor: «Nada mal, chileno. Casi.»' : 'Flor: «¿Agarraste algo? ¿Además del mareo?»';
      this.end(`El Ciclón se detiene. Banderines: ${this.score}.\n${verdict}`);
    }
  }

  /** Radio de cada silla: crece con la velocidad (y la tuya, con lo que te inclines). */
  private chairR(i: number): number {
    return 28 + (this.omega / 2.3) * 40 + (i === 0 ? this.lean : 0);
  }

  private drawCiclon(g: Phaser.GameObjects.Graphics): void {
    const W = BASE_WIDTH;
    g.fillStyle(0x7cb85c, 1).fillRect(0, 0, W, BASE_HEIGHT);
    g.fillStyle(0xc8b890, 1).fillEllipse(160, 96, 250, 150);
    g.fillStyle(0xb0a070, 1).fillEllipse(160, 96, 210, 124);
    for (const f of this.flags) {
      if (f.got > 0) continue;
      const fx = 160 + Math.cos(f.a) * f.r;
      const fy = 92 + Math.sin(f.a) * f.r * 0.62;
      g.fillStyle(0x3a3a48, 1).fillRect(fx, fy - 10, 1, 12);
      g.fillStyle(f.color, 1).fillTriangle(fx + 1, fy - 10, fx + 8, fy - 7, fx + 1, fy - 4);
    }
    const n = 10;
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.sin(this.theta + (a / n) * Math.PI * 2) - Math.sin(this.theta + (b / n) * Math.PI * 2));
    for (const i of order) {
      const a = this.theta + (i / n) * Math.PI * 2;
      const r = this.chairR(i);
      const x = 160 + Math.cos(a) * r;
      const y = 92 + Math.sin(a) * r * 0.62;
      g.lineStyle(1, 0x5a5a68, 1).lineBetween(160, 54, x, y - 6);
      g.fillStyle(INK, 1).fillRect(x - 4, y - 4, 8, 7);
      g.fillStyle(i === 0 ? 0x2c64c0 : i === 1 ? 0xe868a8 : [0xf8dc68, 0x2c9c58, 0xe8742c, 0x8c5cc8][i % 4], 1).fillRect(x - 3, y - 3, 6, 5);
      g.fillStyle(SKIN, 1).fillCircle(x, y - 6, 2.5);
      if (i === 0) g.fillStyle(0xffffff, 1).fillTriangle(x - 3, y - 14, x + 3, y - 14, x, y - 10);
    }
    // El poste y el techito de rayas.
    g.fillStyle(0x8c8c98, 1).fillRect(158, 50, 4, 46);
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2 + this.theta * 0.5;
      const a1 = ((k + 1) / 12) * Math.PI * 2 + this.theta * 0.5;
      g.fillStyle(k % 2 ? 0xc8303c : 0xf8e070, 1).fillTriangle(160, 40, 160 + Math.cos(a0) * 30, 52 + Math.sin(a0) * 8, 160 + Math.cos(a1) * 30, 52 + Math.sin(a1) * 8);
    }
  }

  // -------------------------------------------------------------------------
  // Fotos (teleférico, Rueda, Torre)
  // -------------------------------------------------------------------------

  private setupFotos(): void {
    this.targets = photoTargets(this.mode);
    this.rideMs = this.mode === 'teleferico' ? 34000 : this.mode === 'rueda' ? 32000 : 40000;
    this.panX = this.mode === 'teleferico' ? 120 : 320;
    this.height = this.mode === 'rueda' ? 0 : 1;
  }

  private targetPos(t: PhotoTarget): [number, number] {
    const [x, y] = t.move ? t.move(this.elapsed) : [t.x, t.y];
    // En la Rueda, mientras más abajo, más se esconde todo detrás de los árboles.
    return [x - this.panX, y - this.panY + (1 - this.height) * 50];
  }

  private fotos(dt: number): void {
    const sp = 120;
    if (Controls.isHeld('left')) this.panX -= sp * dt;
    if (Controls.isHeld('right')) this.panX += sp * dt;
    if (Controls.isHeld('up')) this.panY -= 60 * dt;
    if (Controls.isHeld('down')) this.panY += 60 * dt;
    if (this.mode === 'teleferico') this.panX += 8 * dt;
    this.panX = Phaser.Math.Clamp(this.panX, 0, PANO_W - BASE_WIDTH);
    this.panY = Phaser.Math.Clamp(this.panY, -30, 30);
    if (this.mode === 'rueda') this.height = Math.min(1, (this.elapsed * 1000) / (this.rideMs * 0.7));
    this.florLook = Math.sin(this.elapsed * 0.9) > 0.55 ? 1 : 0;
    if (Controls.consume('interact')) this.snap();
    if (this.mode === 'rueda' && Controls.consume('trick')) {
      this.flash = 1;
      playSfx('camera');
      if (this.florLook && !this.selfie) {
        this.selfie = true;
        this.score++;
        this.float('¡Selfie con Flor! (sale guiñando el ojo)', '#f8e070', 160, 140);
      } else if (!this.florLook) this.float('Selfie... con la nuca de Flor.', '#ff9c9c', 160, 140);
    }
    if (this.elapsed * 1000 >= this.rideMs) {
      const names = this.targets.filter((t) => this.taken.includes(t.id)).map((t) => t.name);
      const all = this.taken.length >= this.targets.length;
      const end = { teleferico: 'La cabina frena en la estación.', rueda: 'La rueda se detiene arriba de todo.', torre: 'Bajas de la torre con el celular lleno.' }[this.mode as 'teleferico' | 'rueda' | 'torre'];
      const list = names.length ? `En el celular: ${names.join(', ')}.` : 'No sacaste ni una foto. Pero lo viste todo, que es lo que importa.';
      const extra = all ? '\n¡Todas! Juanpa: «Parce, pásemelas por el grupo.»' : '';
      const selfie = this.selfie ? '\nY una selfie con Flor que no le vas a mostrar a nadie. Todavía.' : '';
      this.end(`${end}\n${list}${extra}${selfie}`);
    }
  }

  private snap(): void {
    this.flash = 1;
    playSfx('camera');
    // Lo que esté adentro del visor, lo más centrado posible.
    let best: PhotoTarget | null = null;
    let bestD = 999;
    for (const t of this.targets) {
      if (t.minH !== undefined && this.height < t.minH) continue;
      const [x, y] = this.targetPos(t);
      const d = Math.hypot(x - BASE_WIDTH / 2, y - BASE_HEIGHT / 2);
      if (Math.abs(x - BASE_WIDTH / 2) < 46 && Math.abs(y - BASE_HEIGHT / 2) < 32 && d < bestD) (best = t), (bestD = d);
    }
    if (!best) {
      this.float('Foto del cielo. Muy artística.', '#dfe6f4', 160, 140);
      return;
    }
    if (this.taken.includes(best.id)) {
      this.float(`Otra de ${best.name}.`, '#dfe6f4', 160, 140);
      return;
    }
    this.taken.push(best.id);
    this.score++;
    this.float(`¡Foto: ${best.name}!`, '#f8e070', 160, 140);
    playSfx('item');
  }

  private drawFotos(g: Phaser.GameObjects.Graphics): void {
    const W = BASE_WIDTH;
    const H = BASE_HEIGHT;
    const sunset = this.mode === 'rueda';
    const bands = sunset ? [0x5c7cc0, 0x8c8cc8, 0xc898b8, 0xe8a888, 0xf0b870, 0xf8c870] : [0x7cbce8, 0x8cc6ec, 0x9ccff0, 0xb0d8f0, 0xc8e0ec, 0xe4e8e0];
    bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, Math.floor((i * H) / bands.length), W, Math.ceil(H / bands.length) + 1));
    const off = (1 - this.height) * 50 - this.panY;
    // Cordillera lejana.
    for (let i = 0; i < 14; i++) {
      const x = i * 80 - this.panX * 0.6;
      g.fillStyle(sunset ? 0x7a6c98 : 0x7a9cb8, 1).fillTriangle(x - 60, 110 + off, x, 66 + (i % 3) * 8 + off, x + 60, 110 + off);
    }
    // Cerros cafeteros y el cañón.
    for (let i = 0; i < 16; i++) {
      const x = i * 70 - this.panX;
      g.fillStyle(sunset ? 0x4c7c3c : 0x5c9c4c, 1).fillEllipse(x + 35, 132 + off, 120, 50);
    }
    if (this.mode === 'teleferico') {
      g.fillStyle(0x3c6c2c, 1).fillRect(0, 140 + off, W, 60);
    }
    // Los blancos.
    for (const t of this.targets) {
      if (t.minH !== undefined && this.height < t.minH - 0.1) continue;
      const [x, y] = this.targetPos(t);
      if (x < -80 || x > W + 80) continue;
      t.draw(g, x, y, this.elapsed);
      if (this.taken.includes(t.id)) g.fillStyle(0x48b860, 1).fillCircle(x + 10, y - 16, 3);
    }
    // Primer plano: los árboles (en la Rueda tapan todo al principio).
    g.fillStyle(0x2c5c2c, 1);
    for (let i = 0; i < 12; i++) g.fillCircle(i * 32 - (this.panX * 1.2) % 32, H - 6 + (1 - this.height) * 0 + off * 0.4, 18);
    // La cabina (marco) y el visor.
    if (this.mode === 'teleferico' || this.mode === 'rueda') {
      g.fillStyle(this.mode === 'rueda' ? 0xe8303c : 0xf8d030, 1).fillRect(0, 0, W, 14).fillRect(0, 0, 10, H).fillRect(W - 10, 0, 10, H);
    }
    if (this.mode === 'rueda') {
      // Flor en la cabina: mira el paisaje o te mira a ti.
      g.fillStyle(0xe868a8, 1).fillRect(W - 46, H - 40, 26, 30);
      g.fillStyle(SKIN, 1).fillCircle(W - 33, H - 48, 9);
      g.fillStyle(0xd8b070, 1).fillRect(W - 43, H - 58, 20, 5).fillRect(W - 43, H - 54, 4, 16);
      if (this.florLook) {
        g.fillStyle(INK, 1).fillRect(W - 37, H - 50, 2, 2).fillRect(W - 31, H - 50, 2, 2);
        g.fillStyle(0xe87878, 1).fillRect(W - 35, H - 45, 4, 1);
      } else g.fillStyle(0xd8b070, 1).fillRect(W - 41, H - 54, 16, 8);
    }
    g.lineStyle(1, 0xffffff, 0.9).strokeRect(W / 2 - 46, H / 2 - 32, 92, 64);
    g.fillStyle(0xffffff, 0.9).fillRect(W / 2 - 1, H / 2 - 5, 2, 10).fillRect(W / 2 - 5, H / 2 - 1, 10, 2);
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private draw(): void {
    const g = this.g;
    g.clear();
    if (this.mode === 'rapidos') this.drawRapidos(g);
    else if (this.mode === 'fabulas') this.drawFabulas(g);
    else if (this.mode === 'tren') this.drawTren(g);
    else if (this.mode === 'show') this.drawShow(g);
    else if (this.mode === 'ciclon') this.drawCiclon(g);
    else this.drawFotos(g);
    if (this.flash > 0) g.fillStyle(0xffffff, this.flash * 0.5).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    const h = this.hud;
    h.clear();
    this.drawBars(h);
    if (this.mode === 'rapidos') {
      // Cuánto se ha mojado cada uno.
      SEATS.forEach((s, k) => {
        const x = 8 + k * 40;
        h.fillStyle(s.color, 1).fillRect(x, 18, 6, 6);
        h.fillStyle(0x0c1020, 0.8).fillRect(x + 8, 19, 28, 4);
        h.fillStyle(0x5cb8f0, 1).fillRect(x + 8, 19, Math.round(0.28 * this.wet[k]), 4);
      });
    }
    this.infoText.setText(this.info());
    if (this.listText) {
      const lines = this.targets.map((t) => `${this.taken.includes(t.id) ? '✓' : '·'} ${t.name}`);
      if (this.mode === 'rueda') lines.push(`${this.selfie ? '✓' : '·'} selfie con Flor (F)`);
      this.listText.setText(lines.join('\n')).setVisible(this.phase === 'play');
    }
  }

  private info(): string {
    switch (this.mode) {
      case 'rapidos':
        return `Mojado: ${Math.round(this.wet[0])}% · río: ${Math.min(100, Math.round((this.dist / RIVER_LEN) * 100))}%`;
      case 'fabulas':
        return `Mojaste: ${this.score} · ${Math.max(0, Math.ceil(40 - this.elapsed))} s`;
      case 'tren':
        return `Saludos y pitazos: ${this.score}/${this.tren.length}`;
      case 'show':
        return `Pasos: ${this.score}/${this.notes.length}${this.combo > 3 ? ` · combo ${this.combo}` : ''}`;
      case 'ciclon':
        return `Banderines: ${this.score} · ${Math.max(0, Math.ceil(42 - this.elapsed))} s`;
      default:
        return `Fotos: ${this.taken.length}/${this.targets.length} · ${Math.max(0, Math.ceil((this.rideMs - this.elapsed * 1000) / 1000))} s`;
    }
  }
}
