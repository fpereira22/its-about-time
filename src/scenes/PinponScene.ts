import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import { MiniScene } from './MiniScene';

/**
 * Misión 8: el torneo de pimpón en el patio de la casita (domingo). Mesa vista desde arriba: tu paleta abajo,
 * el rival arriba. A/D mueven la paleta. Cada golpe tiene un bote: la pelota tiene que picar en el lado del
 * rival; si pica fuera de la mesa es «¡Afuera!» y si no pasa la malla es «¡Red!» (punto para el otro). Solo se
 * devuelve después del bote. Dónde le pegas con la paleta (y A/D al golpear) decide hacia dónde va; con el borde
 * sale muy cruzada y se puede ir afuera. E justo antes de que llegue: ¡remate! (más rápida y más profunda).
 * Tres partidos a 5 puntos: Renzo (se cansa), Juanpa (pega fuerte) y Richi (chiquito pero un muro).
 * Esc: entregar el partido.
 */

export interface PinponResult {
  /** Partidos ganados (de 3). */
  wins: number;
  champion: boolean;
  beatRichi: boolean;
  /** Remates que entraron. */
  smashes: number;
}

export interface PinponSceneData {
  done: (r: PinponResult) => void;
}

interface Rival {
  name: string;
  speed: number;
  error: number;
  hit: number;
  shirt: number;
  intro: string;
  win: string;
  lose: string;
  taunts: string[];
}

const RIVALS: Rival[] = [
  {
    name: 'Renzo',
    speed: 62,
    error: 16,
    hit: 1.0,
    shirt: 0xe8742c,
    intro: 'Renzo: «En Arequipa yo era campeón del barrio, causa. Del barrio. Del pasaje, más bien.»',
    win: 'Renzo: «Me ganaste porque tengo el sánguche en la otra mano. Revancha.»',
    lose: 'Renzo: «¡Arequipa, carajo! República independiente del pimpón.»',
    taunts: ['¡Habla, causa!', 'Uy, se me fue el chicharrón...', '¡Esa sí, esa sí!'],
  },
  {
    name: 'Juanpa',
    speed: 92,
    error: 10,
    hit: 1.18,
    shirt: 0x2c9c58,
    intro: 'Juanpa: «Parce, yo le pego duro. No es nada personal. Bueno, un poquito.»',
    win: 'Juanpa: «¡Qué nivel, parce! Me tumbaste. Me debes una pola igual.»',
    lose: 'Juanpa: «¡Golazo! Perdón, puntazo. Es que soy de fútbol.»',
    taunts: ['¡Tenga!', '¡Pilas, parce!', 'Uy, ¡casi!'],
  },
  {
    name: 'Richi',
    speed: 118,
    error: 6,
    hit: 1.1,
    shirt: 0x5a90e8,
    intro: 'Richi: «Ve, no te confiés por el tamaño. Allá en Pasto jugábamos con achichay y guantes.»',
    win: 'Richi: «¡Ala, chileno! Me ganaste en buena ley. Te invito un hervido... cuando vayamos a Pasto.»',
    lose: 'Richi: «Lo bueno viene en frasco chiquito, ve. ¡Ayayay!»',
    taunts: ['¡Ala!', 'Uy, ¡qué bonito!', '¡Achichay!'],
  },
];

const T = { x: 112, y: 30, w: 96, h: 122 };
const NET_Y = T.y + T.h / 2;
const PAD_W = 18;
const POINTS = 5;
/** Línea de golpe de cada paleta (y) y hasta dónde llega cada jugador de costado. */
const MY_Y = T.y + T.h + 4;
const OP_Y = T.y - 4;
const REACH = { min: T.x - 14, max: T.x + T.w + 14 };

type Side = 'me' | 'them';

/**
 * La pelota en vuelo: va de donde le pegaron (s) a donde pica (l) en `dur` segundos, con su parábola de altura;
 * después del bote sigue con la misma velocidad hacia la paleta del que recibe. `fault` se decide al golpear.
 */
interface Ball {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  lx: number;
  ly: number;
  t: number;
  dur: number;
  vx: number;
  vy: number;
  bounced: boolean;
  /** Segundos desde el bote. */
  after: number;
  /** Cuánto dura el arco después del bote (hasta un poco más allá de la paleta del que recibe). */
  up: number;
  by: Side;
  fault: 'net' | null;
  smash: boolean;
}

export class PinponScene extends MiniScene<PinponResult> {
  private match = 0;
  private me = 0;
  private them = 0;
  private wins = 0;
  private smashes = 0;
  private beatRichi = false;
  private phase: 'intro' | 'serve' | 'play' | 'point' | 'matchEnd' | 'end' = 'intro';
  private phaseMs = 0;
  private px = BASE_WIDTH / 2;
  private ox = BASE_WIDTH / 2;
  private ball: Ball = { x: 0, y: 0, z: 0, sx: 0, sy: 0, lx: 0, ly: 0, t: 0, dur: 1, vx: 0, vy: 0, bounced: false, after: 0, up: 0.45, by: 'me', fault: null, smash: false };
  private smashWindow = 0;
  private server: Side = 'me';
  /** Dónde se marcó la última falta (el circulito de «afuera» / «red»). */
  private mark: { x: number; y: number; ms: number } | null = null;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super('Pinpon');
  }

  init(data: PinponSceneData): void {
    this.initMini(data.done);
    this.match = 0;
    this.wins = 0;
    this.smashes = 0;
    this.beatRichi = false;
    this.phase = 'intro';
  }

  create(): void {
    this.g = this.add.graphics();
    this.hud = this.add.graphics().setDepth(40);
    this.createUi('#c8784c');
    this.scoreText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', fontStyle: '600', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);
    this.hintText.setText('A/D: mover la paleta · E justo antes: ¡remate! · Esc: entregar el partido');
    playMusic('casita');
    this.startMatch();
  }

  private get rival(): Rival {
    return RIVALS[Math.min(this.match, RIVALS.length - 1)];
  }

  private startMatch(): void {
    this.me = 0;
    this.them = 0;
    this.server = 'me';
    this.phase = 'intro';
    this.titleText.setText(`Torneo · Partido ${this.match + 1}/3`);
    this.banner(`${this.rival.intro}\nA 5 puntos. (E para sacar)`);
  }

  private serve(): void {
    this.px = this.ox = BASE_WIDTH / 2;
    this.mark = null;
    const x = BASE_WIDTH / 2 + (Math.random() - 0.5) * 16;
    if (this.server === 'me') this.shoot('me', x, MY_Y, 0, false, 0.6);
    else this.shoot('them', x, OP_Y, 0, false, 0.6);
    this.phase = 'play';
    playSfx('pinpon');
  }

  /**
   * Golpe de `by` desde (x, y). `off` es dónde tocó la paleta (-1 borde izquierdo .. 1 borde derecho); A/D al
   * golpear empujan la dirección. Decide dónde pica (adentro, afuera o en la red) y la velocidad.
   */
  private shoot(by: Side, x: number, y: number, off: number, smash: boolean, speedK = 1): void {
    const half = T.w / 2;
    const cx = T.x + half;
    let lx: number;
    let ly: number;
    let fault: Ball['fault'] = null;
    let speed: number;
    if (by === 'me') {
      const aim = (Controls.isHeld('left') ? -1 : 0) + (Controls.isHeld('right') ? 1 : 0);
      lx = cx + off * half * 0.9 + aim * 18 + (Math.random() - 0.5) * 8;
      // Con el borde de la paleta la pelota sale muy cruzada: a veces se va afuera.
      if (Math.abs(off) > 0.85 && Math.random() < 0.35) lx += Math.sign(off) * (10 + Math.random() * 10);
      ly = smash ? T.y + 6 + Math.random() * 14 : T.y + 12 + Math.random() * (NET_Y - T.y - 28);
      if (smash && Math.random() < 0.08) fault = 'net';
      speed = (smash ? 215 : 125) * speedK;
    } else {
      const r = this.rival;
      // Apunta lejos de ti, con su error.
      const away = this.px < cx ? 1 : -1;
      lx = cx + away * (10 + Math.random() * 28) + (Math.random() - 0.5) * r.error * 2;
      lx = Phaser.Math.Clamp(lx, T.x + 3, T.x + T.w - 3);
      ly = NET_Y + 14 + Math.random() * (T.y + T.h - NET_Y - 22);
      const roll = Math.random() * 100;
      if (roll < r.error * 0.5) fault = 'net';
      else if (roll < r.error * 1.1) lx = Math.random() < 0.5 ? T.x - 4 - Math.random() * 10 : T.x + T.w + 4 + Math.random() * 10;
      speed = 115 * r.hit * speedK;
    }
    // Si va a la red, el tiro termina en la malla (con un arco bajito) en vez de pasarla por encima.
    if (fault === 'net') {
      lx = Phaser.Math.Clamp(lx, T.x - 4, T.x + T.w + 4);
      ly = NET_Y + (by === 'me' ? 3 : -3);
    }
    const dur = Math.max(0.25, Math.hypot(lx - x, ly - y) / speed);
    const b: Ball = { x, y, z: 4, sx: x, sy: y, lx, ly, t: 0, dur, vx: (lx - x) / dur, vy: (ly - y) / dur, bounced: false, after: 0, up: 0.45, by, fault, smash };
    if (fault === null) {
      // Después del bote, que llegue a donde el otro alcanza a correr.
      const tLine = ((by === 'me' ? OP_Y : MY_Y) - ly) / b.vy;
      const xLine = lx + b.vx * tLine;
      if (tLine > 0 && (xLine < REACH.min + 2 || xLine > REACH.max - 2)) b.vx = (Phaser.Math.Clamp(xLine, REACH.min + 2, REACH.max - 2) - lx) / tLine;
      // El arco del bote dura hasta un poco más allá de la paleta: así no vuelve a picar en la mesa.
      if (tLine > 0) b.up = tLine * 1.2;
    }
    this.ball = b;
  }

  /** ¿El punto (x, y) cae dentro de la mesa? */
  private onTable(x: number, y: number): boolean {
    return x >= T.x && x <= T.x + T.w && y >= T.y && y <= T.y + T.h;
  }

  override update(_t: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    const dt = Math.min(delta, 40) / 1000;
    this.phaseMs += delta;
    if (this.phase === 'intro') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        this.serve();
      }
    } else if (this.phase === 'play') {
      this.play(dt);
    } else if (this.phase === 'point') {
      if (this.phaseMs > 900) this.serve();
    } else if (this.phase === 'matchEnd') {
      if (this.phaseMs > 400 && Controls.consume('interact')) {
        this.hideBanner();
        this.match++;
        if (this.match < RIVALS.length) this.startMatch();
        else {
          this.phase = 'end';
          const verdict =
            this.wins === 3
              ? '¡CAMPEÓN DE LA CASITA! Doña Rubiela te hace una corona de papel.'
              : this.wins === 2
                ? 'Dos de tres. Subcampeón con honores (y con hambre).'
                : this.wins === 1
                  ? 'Uno de tres. Richi: «Lo importante es participar, ve.»'
                  : 'Cero de tres. Renzo: «Tranquilo, causa: el pimpón no es para todos.»';
          this.banner(`${verdict}\n(E para seguir)`);
        }
      }
    } else if (this.phase === 'end') {
      if (Controls.consume('interact')) this.finish({ wins: this.wins, champion: this.wins === 3, beatRichi: this.beatRichi, smashes: this.smashes });
    }
    this.draw();
  }

  private play(dt: number): void {
    if (Controls.consume('menu')) {
      this.them = POINTS;
      this.endMatch();
      return;
    }
    const sp = 150;
    if (Controls.isHeld('left')) this.px -= sp * dt;
    if (Controls.isHeld('right')) this.px += sp * dt;
    this.px = Phaser.Math.Clamp(this.px, REACH.min, REACH.max);
    if (Controls.consume('interact')) this.smashWindow = 0.22;
    this.smashWindow = Math.max(0, this.smashWindow - dt);

    const b = this.ball;
    // El rival va hacia donde la pelota va a cruzar su línea (con su velocidad y su error).
    let target = BASE_WIDTH / 2;
    if (b.by === 'me' && b.fault === null) {
      const tLine = (OP_Y - b.ly) / b.vy;
      target = b.lx + b.vx * tLine + Math.sin(this.time.now / 300) * this.rival.error * 0.6;
    }
    const d = target - this.ox;
    this.ox = Phaser.Math.Clamp(this.ox + Phaser.Math.Clamp(d, -this.rival.speed * dt, this.rival.speed * dt), REACH.min, REACH.max);

    if (!b.bounced) {
      b.t = Math.min(1, b.t + dt / b.dur);
      b.x = b.sx + (b.lx - b.sx) * b.t;
      b.y = b.sy + (b.ly - b.sy) * b.t;
      b.z = 4 * (1 - b.t) + (b.fault === 'net' ? 3 : b.smash ? 7 : 12) * 4 * b.t * (1 - b.t);
      if (b.t >= 1) {
        // La red: el tiro bajito se clavó en la malla.
        if (b.fault === 'net') {
          b.z = 0;
          this.fault('¡Red!', b.x, b.y, b.by === 'me' ? 'them' : 'me');
          return;
        }
        if (!this.onTable(b.lx, b.ly)) {
          b.z = 0;
          this.fault('¡Afuera!', b.lx, b.ly, b.by === 'me' ? 'them' : 'me');
          return;
        }
        b.bounced = true;
        b.after = 0;
        playSfx('pinpon');
      }
      return;
    }

    // Después del bote: sube un poco y baja hacia la paleta del que recibe.
    b.after += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z = Math.max(0, Math.sin(Math.min(1, b.after / b.up) * Math.PI) * 8);
    // Si vuelve a picar en la mesa antes de que se la devuelvan: dos botes, punto para el que pegó.
    if (b.after >= b.up && this.onTable(b.x, b.y)) {
      this.fault('¡Dos botes!', b.x, b.y, b.by);
      return;
    }
    if (b.by === 'them') {
      // Me toca: solo después del bote.
      if (b.y >= MY_Y - 3 && b.y <= MY_Y + 6 && Math.abs(b.x - this.px) <= PAD_W / 2 + 2) {
        const off = Phaser.Math.Clamp((b.x - this.px) / (PAD_W / 2), -1, 1);
        const smash = this.smashWindow > 0;
        if (smash) {
          this.smashWindow = 0;
          this.smashes++;
          this.float('¡REMATE!', '#f8e070', this.px, MY_Y - 14);
          playSfx('taco');
        } else playSfx('pinpon');
        this.shoot('me', b.x, MY_Y - 3, off, smash);
        return;
      }
      if (b.y > MY_Y + 12) this.point('them');
    } else {
      if (b.y <= OP_Y + 3 && b.y >= OP_Y - 6 && Math.abs(b.x - this.ox) <= PAD_W / 2 + 2) {
        playSfx('pinpon');
        if (Math.random() < 0.12) this.say(this.rival.taunts[Math.floor(Math.random() * this.rival.taunts.length)], this.ox, T.y - 6, 900);
        // A un remate le cuesta responder: la devuelve más lenta.
        this.shoot('them', b.x, OP_Y + 3, 0, false, b.smash ? 0.85 : 1);
        return;
      }
      if (b.y < OP_Y - 12) this.point('me');
    }
  }

  /** Falta (red o afuera): marca dónde fue y punto para `who`. */
  private fault(text: string, x: number, y: number, who: Side): void {
    this.mark = { x, y, ms: 900 };
    this.float(text, '#f8e070', x, y - 8);
    playSfx('golpe');
    this.point(who);
  }

  private point(who: Side): void {
    if (who === 'me') this.me++;
    else this.them++;
    // El aviso al costado de la mesa, no encima de la malla.
    this.float(who === 'me' ? '¡Punto!' : `Punto de ${this.rival.name}`, who === 'me' ? '#a8e0a0' : '#ff9c9c', who === 'me' ? 58 : 262, NET_Y);
    playSfx(who === 'me' ? 'blip' : 'cancel');
    this.server = who === 'me' ? 'them' : 'me';
    if (this.me >= POINTS || this.them >= POINTS) {
      this.endMatch();
      return;
    }
    this.phase = 'point';
    this.phaseMs = 0;
  }

  private endMatch(): void {
    const won = this.me >= POINTS && this.me > this.them;
    if (won) {
      this.wins++;
      if (this.rival.name === 'Richi') this.beatRichi = true;
    }
    this.phase = 'matchEnd';
    this.phaseMs = 0;
    playSfx(won ? 'item' : 'error');
    this.banner(`${won ? '¡Ganaste' : 'Perdiste'} ${this.me} a ${this.them}.\n${won ? this.rival.win : this.rival.lose}\n(E para seguir)`);
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    // El patio: terracota, materas y la hamaca al fondo.
    g.fillStyle(0xc8784c, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let y = 0; y < BASE_HEIGHT; y += 16) for (let x = 0; x < BASE_WIDTH; x += 16) g.fillStyle(0xa85c34, 1).fillRect(x, y, 16, 1).fillRect(x, y, 1, 16);
    for (const [x, y] of [[24, 30], [36, 150], [284, 40], [296, 140]] as const) {
      g.fillStyle(0xc0603c, 1).fillRect(x - 6, y, 12, 10);
      g.fillStyle(0x2c9c58, 1).fillCircle(x, y - 3, 9);
      g.fillStyle(0xe868a8, 1).fillRect(x - 3, y - 6, 2, 2);
    }
    // La mesa.
    g.fillStyle(0x2a2433, 1).fillRect(T.x - 2, T.y - 2, T.w + 4, T.h + 4);
    g.fillStyle(0x1c6a8c, 1).fillRect(T.x, T.y, T.w, T.h);
    g.lineStyle(1, 0xf4f0e6, 1).strokeRect(T.x + 1, T.y + 1, T.w - 2, T.h - 2);
    g.lineBetween(T.x + T.w / 2, T.y, T.x + T.w / 2, T.y + T.h);
    g.fillStyle(0xe8e8e8, 1).fillRect(T.x - 6, NET_Y - 1, T.w + 12, 2);
    g.fillStyle(0x2a2433, 1).fillRect(T.x - 7, NET_Y - 2, 2, 4).fillRect(T.x + T.w + 5, NET_Y - 2, 2, 4);
    // Jugadores (de arriba): cabeza y paleta.
    const player = (x: number, y: number, shirt: number, top: boolean): void => {
      g.fillStyle(0x2a2433, 1).fillCircle(x, y, 7);
      g.fillStyle(shirt, 1).fillCircle(x, y, 6);
      g.fillStyle(0x3a2418, 1).fillCircle(x, y + (top ? -1 : 1), 4);
    };
    player(this.ox, T.y - 12, this.rival.shirt, true);
    player(this.px, T.y + T.h + 12, 0x2c64c0, false);
    g.fillStyle(0xc8303c, 1).fillRoundedRect(this.ox - PAD_W / 2, T.y - 6, PAD_W, 4, 2);
    g.fillStyle(this.smashWindow > 0 ? 0xf8e070 : 0xc8303c, 1).fillRoundedRect(this.px - PAD_W / 2, T.y + T.h + 2, PAD_W, 4, 2);
    // La pelota y su sombra.
    if (this.phase === 'play' || (this.phase === 'point' && this.mark)) {
      const b = this.ball;
      g.fillStyle(0x000000, 0.25).fillCircle(b.x + 1, b.y + 1, 2);
      g.fillStyle(0xf8f4ec, 1).fillCircle(b.x, b.y - b.z, 2);
    }
    if (this.mark && this.mark.ms > 0) {
      this.mark.ms -= this.game.loop.delta;
      g.lineStyle(1, 0xf8e070, 1).strokeCircle(this.mark.x, this.mark.y, 4);
    }
    const h = this.hud;
    h.clear();
    this.drawBars(h);
    this.scoreText.setText(`Tú ${this.me} – ${this.them} ${this.rival.name}   ·   Ganados: ${this.wins}`);
  }
}
