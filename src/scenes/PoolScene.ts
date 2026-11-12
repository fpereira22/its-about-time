import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import { MiniScene } from './MiniScene';

/**
 * Misión 8: pool con Danilo en Billares El Arriero (Salento), visto desde arriba. Una partida corta de bola 8:
 * tú las lisas (amarilla, azul, roja), Danilo las rayadas, y al final la negra. A/D apuntan (W/S, de a poquito),
 * E empieza a cargar el golpe y E otra vez le pega a la blanca. Si metes una tuya, sigues; si metes la blanca,
 * Danilo pone la blanca donde quiere. Meter la negra antes de tiempo es perder. Danilo, que es psicólogo, opina
 * de todo entre tiro y tiro. Esc: rendirse (pierdes, pero con dignidad).
 */

export interface PoolResult {
  won: boolean;
  /** Bolas tuyas metidas. */
  mine: number;
  scratches: number;
  /** Metiste dos en un mismo tiro. */
  double: boolean;
}

export interface PoolSceneData {
  done: (r: PoolResult) => void;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sunk: boolean;
  color: number;
  stripe: boolean;
}

type Owner = 'me' | 'danilo';

const R = 4;
const TABLE = { x: 44, y: 34, w: 232, h: 118 };
const POCKET_R = 7.5;
const FRICTION = 0.988;
const MIN_V = 0.03;
const MAX_POWER = 8.5;
const MAX_TURNS = 16;

const POCKETS = [
  [TABLE.x, TABLE.y],
  [TABLE.x + TABLE.w / 2, TABLE.y - 2],
  [TABLE.x + TABLE.w, TABLE.y],
  [TABLE.x, TABLE.y + TABLE.h],
  [TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h + 2],
  [TABLE.x + TABLE.w, TABLE.y + TABLE.h],
] as const;

/** Lo que dice Danilo entre tiro y tiro (psicólogo caleño a muerte). */
const DANILO_LINES = [
  'Ah ve, ¿y cómo te hace sentir esa bola?',
  'Vos le pegás duro a la blanca. Interesante. Muy interesante.',
  'La nostalgia es como el pool, ve: uno apunta pa\'trás y la bola se va pa\'lante.',
  'Esa la fallaste por pensar en Chile. Te vi la cara.',
  'Yo no te analizo, parce. Bueno, un poquito.',
  'En Cali le decimos «la de las tres bandas». Acá le dicen «suerte».',
  '¿Y el corazón qué? ...No, nada, nada. Tirá, ve.',
  'Vojabés que uno no mete la bola: la bola se deja meter. Freud, creo.',
  'Si la negra entra antes, es un acto fallido. Te aviso.',
  'Respirá. Inhalá. Exhalá. Ahora sí, ¡dale!',
];
const DANILO_FAIL = ['¡Uy, no! Era pa\' esa. Ni modo.', 'Proyecté. Eso fue proyección.', 'Esa mesa está chueca, ve. Comprobado científicamente.'];
const DANILO_OK = ['¡Ahí está! ¡Caleño, papá!', 'Mirá y aprendé, chileno.', '¡Uff! ¡Qué chimba de tiro!'];

export class PoolScene extends MiniScene<PoolResult> {
  private balls: Ball[] = [];
  private turn: Owner = 'me';
  private phase: 'intro' | 'aim' | 'power' | 'rolling' | 'ai' | 'over' = 'intro';
  private angle = Math.PI;
  private power = 0;
  private powerDir = 1;
  private aiTimer = 0;
  private sunkThisShot: Ball[] = [];
  private firstHit: Ball | null = null;
  private mine = 0;
  private scratches = 0;
  private double = false;
  private won = false;
  private turns = 0;
  private lineIdx = 0;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('Pool');
  }

  init(data: PoolSceneData): void {
    this.initMini(data.done);
    this.turn = 'me';
    this.phase = 'intro';
    this.angle = Math.PI;
    this.power = 0;
    this.mine = 0;
    this.scratches = 0;
    this.double = false;
    this.won = false;
    this.turns = 0;
    this.lineIdx = 0;
    this.rack();
  }

  create(): void {
    this.g = this.add.graphics();
    this.hud = this.add.graphics().setDepth(40);
    this.createUi('#1c120c');
    this.statusText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', color: '#dfe6f4' }).setOrigin(1, 0).setDepth(50);
    this.titleText.setText('Pool con Danilo · Billares El Arriero');
    this.hintText.setText('A/D apuntar · W/S fino · E cargar y E tirar · Esc rendirse');
    playMusic('billar');
    this.banner('Bola 8, versión corta: tú las LISAS (amarilla, azul, roja),\nDanilo las RAYADAS. Después, la negra.\nDanilo: «Tirá vos primero. Es terapéutico.»\n(E para empezar)');
  }

  private rack(): void {
    const mk = (id: number, x: number, y: number, color: number, stripe = false): Ball => ({ id, x, y, vx: 0, vy: 0, sunk: false, color, stripe });
    const fx = TABLE.x + TABLE.w * 0.72;
    const cy = TABLE.y + TABLE.h / 2;
    const d = R * 2 + 0.4;
    this.balls = [
      mk(0, TABLE.x + TABLE.w * 0.25, cy, 0xf4f0e6),
      mk(1, fx, cy, 0xe8b828),
      mk(9, fx + d * 0.87, cy - R - 0.2, 0xe8b828, true),
      mk(2, fx + d * 0.87, cy + R + 0.2, 0x2c64c0),
      mk(8, fx + d * 1.74, cy, 0x101014),
      mk(10, fx + d * 1.74, cy - d, 0x2c64c0, true),
      mk(3, fx + d * 1.74, cy + d, 0xc8303c),
      mk(11, fx + d * 2.61, cy - R - 0.2, 0xc8303c, true),
    ];
  }

  private get cue(): Ball {
    return this.balls[0];
  }

  private group(o: Owner): Ball[] {
    return this.balls.filter((b) => b.id !== 0 && b.id !== 8 && (o === 'me' ? b.id < 8 : b.id > 8));
  }

  private left(o: Owner): number {
    return this.group(o).filter((b) => !b.sunk).length;
  }

  override update(_t: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    if (this.phase === 'intro') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        this.phase = 'aim';
      }
    } else if (this.phase === 'over') {
      if (Controls.consume('interact')) this.finish({ won: this.won, mine: this.mine, scratches: this.scratches, double: this.double });
    } else if (this.phase === 'aim' || this.phase === 'power') {
      this.playerInput(delta);
    } else if (this.phase === 'ai') {
      this.aiTimer -= delta;
      if (this.aiTimer <= 0) this.aiShoot();
    } else if (this.phase === 'rolling') {
      // Varios pasos chicos por frame: las bolas rápidas no se atraviesan.
      for (let i = 0; i < 4; i++) this.stepBalls();
      if (this.balls.every((b) => b.sunk || (Math.abs(b.vx) < MIN_V && Math.abs(b.vy) < MIN_V))) this.endShot();
    }
    this.draw();
  }

  private playerInput(delta: number): void {
    if (Controls.consume('menu')) {
      this.won = false;
      this.phase = 'over';
      this.banner('Danilo: «¿Te rendís? Ah ve, eso dice mucho de vos, parce.\nPero tranqui: no te voy a cobrar la sesión.»\n(E para seguir)');
      return;
    }
    const k = delta / 1000;
    if (Controls.isHeld('left')) this.angle -= 1.6 * k;
    if (Controls.isHeld('right')) this.angle += 1.6 * k;
    if (Controls.isHeld('up')) this.angle -= 0.25 * k;
    if (Controls.isHeld('down')) this.angle += 0.25 * k;
    if (this.phase === 'aim') {
      if (Controls.consume('interact')) {
        this.phase = 'power';
        this.power = 0;
        this.powerDir = 1;
      }
      return;
    }
    this.power += this.powerDir * k * 1.15;
    if (this.power >= 1) (this.power = 1), (this.powerDir = -1);
    if (this.power <= 0.05) (this.power = 0.05), (this.powerDir = 1);
    if (Controls.consume('interact')) this.shoot(this.angle, this.power);
  }

  private shoot(angle: number, power: number): void {
    const v = 0.6 + power * MAX_POWER;
    this.cue.vx = Math.cos(angle) * v;
    this.cue.vy = Math.sin(angle) * v;
    this.sunkThisShot = [];
    this.firstHit = null;
    this.phase = 'rolling';
    playSfx('taco');
  }

  private stepBalls(): void {
    const k = 0.25;
    for (const b of this.balls) {
      if (b.sunk) continue;
      b.x += b.vx * k;
      b.y += b.vy * k;
      const f = Math.pow(FRICTION, k);
      b.vx *= f;
      b.vy *= f;
      if (Math.abs(b.vx) < MIN_V && Math.abs(b.vy) < MIN_V) (b.vx = 0), (b.vy = 0);
      for (const [px, py] of POCKETS) {
        if (Math.hypot(b.x - px, b.y - py) < POCKET_R) {
          b.sunk = true;
          b.vx = 0;
          b.vy = 0;
          this.sunkThisShot.push(b);
          playSfx('tronera');
          break;
        }
      }
      if (b.sunk) continue;
      // Bandas.
      if (b.x < TABLE.x + R) (b.x = TABLE.x + R), (b.vx = Math.abs(b.vx) * 0.82);
      if (b.x > TABLE.x + TABLE.w - R) (b.x = TABLE.x + TABLE.w - R), (b.vx = -Math.abs(b.vx) * 0.82);
      if (b.y < TABLE.y + R) (b.y = TABLE.y + R), (b.vy = Math.abs(b.vy) * 0.82);
      if (b.y > TABLE.y + TABLE.h - R) (b.y = TABLE.y + TABLE.h - R), (b.vy = -Math.abs(b.vy) * 0.82);
    }
    // Choques entre bolas (elásticos, misma masa).
    for (let i = 0; i < this.balls.length; i++) {
      const a = this.balls[i];
      if (a.sunk) continue;
      for (let j = i + 1; j < this.balls.length; j++) {
        const b = this.balls[j];
        if (b.sunk) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= R * 2 || d === 0) continue;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = R * 2 - d;
        a.x -= (nx * overlap) / 2;
        a.y -= (ny * overlap) / 2;
        b.x += (nx * overlap) / 2;
        b.y += (ny * overlap) / 2;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 0) continue;
        a.vx -= rel * nx;
        a.vy -= rel * ny;
        b.vx += rel * nx;
        b.vy += rel * ny;
        if (a.id === 0 && !this.firstHit) this.firstHit = b;
        if (b.id === 0 && !this.firstHit) this.firstHit = a;
        if (rel > 0.4) playSfx('bola');
      }
    }
  }

  private endShot(): void {
    const who = this.turn;
    const mineSunk = this.sunkThisShot.filter((b) => this.group(who).includes(b));
    const eight = this.sunkThisShot.some((b) => b.id === 8);
    const scratch = this.cue.sunk;
    if (who === 'me') {
      this.mine += mineSunk.length;
      if (mineSunk.length >= 2) this.double = true;
      if (scratch) this.scratches++;
    }
    this.turns++;
    if (eight) {
      // La negra: gana el que la mete con su grupo terminado (y sin meter la blanca).
      const legal = this.left(who) === 0 && !scratch;
      this.won = who === 'me' ? legal : !legal;
      this.gameOver(
        who === 'me'
          ? legal
            ? 'Metiste la negra. ¡GANASTE!\nDanilo: «Bueno, ya. Esto lo vamos a trabajar en la próxima sesión.»'
            : 'La negra se fue antes de tiempo... perdiste.\nDanilo: «Ah ve, eso es un acto fallido de libro.»'
          : legal
            ? 'Danilo mete la negra. Perdiste.\nDanilo: «No es que yo sea bueno: es que vos estabas pensando en otra cosa.»'
            : '¡Danilo metió la negra antes de tiempo! Ganaste.\nDanilo: «...Eso no cuenta. Bueno, sí cuenta. Ganaste.»',
      );
      return;
    }
    if (scratch) {
      this.cue.sunk = false;
      this.cue.x = TABLE.x + TABLE.w * 0.25;
      this.cue.y = TABLE.y + TABLE.h / 2;
      this.cue.vx = 0;
      this.cue.vy = 0;
      this.float(who === 'me' ? '¡Metiste la blanca!' : '¡Danilo metió la blanca!', '#ff9c9c', this.cue.x, this.cue.y - 10);
    }
    if (this.turns >= MAX_TURNS * 2) {
      const meLeft = this.left('me');
      const daLeft = this.left('danilo');
      this.won = meLeft < daLeft || (meLeft === daLeft && this.mine > 0);
      this.gameOver(`El dueño apaga una luz: «¡Última ronda, muchachos!»\n${this.won ? 'Te quedan menos bolas: ganas por puntos.' : 'A Danilo le quedan menos: gana él por puntos.'}`);
      return;
    }
    const keep = mineSunk.length > 0 && !scratch;
    if (who === 'danilo') {
      if (keep) this.say(DANILO_OK[Math.floor(Math.random() * DANILO_OK.length)], 160, 168, 1400);
      else this.say(DANILO_FAIL[Math.floor(Math.random() * DANILO_FAIL.length)], 160, 168, 1400);
    } else if (keep) {
      this.float('¡Adentro!', '#a8e0a0', BASE_WIDTH / 2, 26);
    }
    if (!keep) this.turn = who === 'me' ? 'danilo' : 'me';
    if (this.turn === 'danilo') {
      this.phase = 'ai';
      this.aiTimer = 1300;
      if (!keep) {
        this.say(DANILO_LINES[this.lineIdx % DANILO_LINES.length], 160, 168, 2400);
        this.lineIdx++;
      }
    } else {
      this.phase = 'aim';
      this.angle = this.suggestAngle();
    }
  }

  private gameOver(text: string): void {
    this.phase = 'over';
    playSfx(this.won ? 'item' : 'error');
    this.banner(`${text}\n(E para seguir)`);
  }

  /** Para empezar a apuntar: hacia la bola tuya más cercana. */
  private suggestAngle(): number {
    const targets = this.left('me') > 0 ? this.group('me').filter((b) => !b.sunk) : this.balls.filter((b) => b.id === 8 && !b.sunk);
    const t = targets.sort((a, b) => Math.hypot(a.x - this.cue.x, a.y - this.cue.y) - Math.hypot(b.x - this.cue.x, b.y - this.cue.y))[0];
    return t ? Math.atan2(t.y - this.cue.y, t.x - this.cue.x) : this.angle;
  }

  /** Danilo elige la combinación bola-tronera más fácil, apunta a la «bola fantasma» y falla un poquito. */
  private aiShoot(): void {
    const targets = this.left('danilo') > 0 ? this.group('danilo').filter((b) => !b.sunk) : this.balls.filter((b) => b.id === 8 && !b.sunk);
    let best: { angle: number; score: number } | null = null;
    for (const t of targets) {
      for (const [px, py] of POCKETS) {
        const toPocket = Math.atan2(py - t.y, px - t.x);
        const gx = t.x - Math.cos(toPocket) * R * 2;
        const gy = t.y - Math.sin(toPocket) * R * 2;
        const a = Math.atan2(gy - this.cue.y, gx - this.cue.x);
        const cut = Math.abs(Phaser.Math.Angle.Wrap(a - toPocket));
        if (cut > 1.2) continue;
        const score = cut * 2 + Math.hypot(px - t.x, py - t.y) / 120 + Math.hypot(gx - this.cue.x, gy - this.cue.y) / 200;
        if (!best || score < best.score) best = { angle: a, score };
      }
    }
    const angle = (best?.angle ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 0.16;
    this.turn = 'danilo';
    this.shoot(angle, 0.45 + Math.random() * 0.3);
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private draw(): void {
    const g = this.g;
    g.clear();
    // El bar de fondo: piso de madera y la lámpara sobre la mesa.
    g.fillStyle(0x3a2418, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let y = 0; y < BASE_HEIGHT; y += 12) g.fillStyle(0x4a2c1c, 1).fillRect(0, y, BASE_WIDTH, 1);
    g.fillStyle(0xf8e8a8, 0.06).fillEllipse(BASE_WIDTH / 2, BASE_HEIGHT / 2 + 4, 300, 150);
    // La mesa.
    g.fillStyle(0x2a1810, 1).fillRoundedRect(TABLE.x - 14, TABLE.y - 14, TABLE.w + 28, TABLE.h + 28, 6);
    g.fillStyle(0x6a3c1c, 1).fillRoundedRect(TABLE.x - 11, TABLE.y - 11, TABLE.w + 22, TABLE.h + 22, 5);
    g.fillStyle(0x15663a, 1).fillRect(TABLE.x - 3, TABLE.y - 3, TABLE.w + 6, TABLE.h + 6);
    g.fillStyle(0x1c7a44, 1).fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
    for (const x of [0.25, 0.5, 0.75]) g.fillStyle(0xe8d8b0, 1).fillCircle(TABLE.x + TABLE.w * x, TABLE.y - 7, 1).fillCircle(TABLE.x + TABLE.w * x, TABLE.y + TABLE.h + 7, 1);
    g.lineStyle(1, 0x2c9c58, 0.6).lineBetween(TABLE.x + TABLE.w * 0.25, TABLE.y, TABLE.x + TABLE.w * 0.25, TABLE.y + TABLE.h);
    for (const [px, py] of POCKETS) g.fillStyle(0x0c0c10, 1).fillCircle(px, py, POCKET_R);

    // Línea de mira y taco.
    const aiming = (this.phase === 'aim' || this.phase === 'power') && this.turn === 'me';
    if (aiming) {
      const c = this.cue;
      const ca = Math.cos(this.angle);
      const sa = Math.sin(this.angle);
      const hit = this.raycast(c.x, c.y, ca, sa);
      for (let d = 8; d < hit.dist; d += 6) g.fillStyle(0xffffff, 0.55).fillRect(Math.round(c.x + ca * d), Math.round(c.y + sa * d), 1, 1);
      g.lineStyle(1, 0xffffff, 0.7).strokeCircle(c.x + ca * hit.dist, c.y + sa * hit.dist, R);
      if (hit.ball) {
        const nx = hit.ball.x - (c.x + ca * hit.dist);
        const ny = hit.ball.y - (c.y + sa * hit.dist);
        const n = Math.hypot(nx, ny) || 1;
        g.lineStyle(1, 0xf8e070, 0.8).lineBetween(hit.ball.x, hit.ball.y, hit.ball.x + (nx / n) * 22, hit.ball.y + (ny / n) * 22);
      }
      const back = 8 + (this.phase === 'power' ? this.power * 16 : 0);
      g.lineStyle(3, 0x2a1810, 1).lineBetween(c.x - ca * back, c.y - sa * back, c.x - ca * (back + 70), c.y - sa * (back + 70));
      g.lineStyle(2, 0xd8a868, 1).lineBetween(c.x - ca * back, c.y - sa * back, c.x - ca * (back + 70), c.y - sa * (back + 70));
      g.lineStyle(2, 0x5a8ad8, 1).lineBetween(c.x - ca * back, c.y - sa * back, c.x - ca * (back + 3), c.y - sa * (back + 3));
    }

    // Bolas.
    for (const b of this.balls) {
      if (b.sunk) continue;
      g.fillStyle(0x000000, 0.3).fillCircle(b.x + 1, b.y + 1.5, R);
      if (b.stripe) {
        g.fillStyle(0xf4f0e6, 1).fillCircle(b.x, b.y, R);
        g.fillStyle(b.color, 1).fillRect(b.x - R, b.y - 1.5, R * 2, 3);
      } else g.fillStyle(b.color, 1).fillCircle(b.x, b.y, R);
      g.fillStyle(0xffffff, 0.6).fillRect(b.x - 2, b.y - 2, 1, 1);
    }

    // Barra de fuerza y marcador.
    const h = this.hud;
    h.clear();
    this.drawBars(h);
    if (this.phase === 'power') {
      h.fillStyle(0x0c1020, 0.85).fillRect(12, 40, 12, 104);
      const p = Math.round(this.power * 100);
      h.fillStyle(this.power > 0.8 ? 0xe85a64 : this.power > 0.45 ? 0xf8e070 : 0x5cc880, 1).fillRect(14, 142 - p, 8, p);
    }
    const dot = (x: number, color: number, on: boolean): void => {
      h.fillStyle(on ? color : 0x3a4060, 1).fillCircle(x, BASE_HEIGHT - 20, 3);
    };
    this.group('me').forEach((b, i) => dot(14 + i * 8, b.color, !b.sunk));
    this.group('danilo').forEach((b, i) => dot(BASE_WIDTH - 30 + i * 8, b.color, !b.sunk));
    this.statusText.setText(this.phase === 'over' ? '' : this.turn === 'me' ? 'Tu turno (lisas)' : 'Turno de Danilo (rayadas)');
  }

  /** Hasta dónde llega la blanca en línea recta (la primera bola o la banda). */
  private raycast(x: number, y: number, dx: number, dy: number): { dist: number; ball: Ball | null } {
    let best = Infinity;
    let ball: Ball | null = null;
    for (const b of this.balls) {
      if (b.sunk || b.id === 0) continue;
      const fx = b.x - x;
      const fy = b.y - y;
      const t = fx * dx + fy * dy;
      if (t <= 0) continue;
      const perp = Math.hypot(fx - dx * t, fy - dy * t);
      if (perp > R * 2) continue;
      const d = t - Math.sqrt(R * 2 * R * 2 - perp * perp);
      if (d < best) (best = d), (ball = b);
    }
    const tx = dx > 0 ? (TABLE.x + TABLE.w - R - x) / dx : dx < 0 ? (TABLE.x + R - x) / dx : Infinity;
    const ty = dy > 0 ? (TABLE.y + TABLE.h - R - y) / dy : dy < 0 ? (TABLE.y + R - y) / dy : Infinity;
    const wall = Math.min(tx, ty);
    if (wall < best) return { dist: wall, ball: null };
    return { dist: best, ball };
  }
}
