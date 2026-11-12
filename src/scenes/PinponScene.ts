import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import { MiniScene } from './MiniScene';

/**
 * Misión 8: el torneo de pimpón en el patio de la casita (domingo). Mesa vista desde arriba: tu paleta abajo,
 * el rival arriba. A/D mueven la paleta; la pelota rebota según dónde le pegues (en el borde sale cruzada).
 * E justo antes de que llegue: ¡remate! (más rápida y difícil de devolver; si le pegas con el borde, sale muy cruzada).
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
  private ball = { x: 0, y: 0, vx: 0, vy: 0, z: 0 };
  private smashWindow = 0;
  private server: 'me' | 'them' = 'me';
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
    const down = this.server === 'them';
    this.ball = { x: BASE_WIDTH / 2 + (Math.random() - 0.5) * 20, y: down ? T.y + 16 : T.y + T.h - 16, vx: (Math.random() - 0.5) * 50, vy: down ? 95 : -95, z: 0 };
    this.phase = 'play';
    playSfx('pinpon');
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
    this.px = Phaser.Math.Clamp(this.px, T.x - 14, T.x + T.w + 14);
    if (Controls.consume('interact')) this.smashWindow = 0.22;
    this.smashWindow = Math.max(0, this.smashWindow - dt);

    // El rival sigue la pelota (con su velocidad y su error).
    const target = this.ball.vy < 0 ? this.ball.x + Math.sin(this.time.now / 300) * this.rival.error : BASE_WIDTH / 2;
    const d = target - this.ox;
    this.ox += Phaser.Math.Clamp(d, -this.rival.speed * dt, this.rival.speed * dt);

    const b = this.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z = Math.abs(Math.sin(((b.y - T.y) / T.h) * Math.PI * 2)) * 6;
    if (b.x < T.x - 26 || b.x > T.x + T.w + 26) {
      // Se fue por el costado: punto para el que no le pegó.
      this.point(b.vy > 0 ? 'me' : 'them');
      return;
    }
    // Mi paleta.
    const myY = T.y + T.h + 4;
    if (b.vy > 0 && b.y >= myY - 3 && b.y <= myY + 6) {
      if (Math.abs(b.x - this.px) <= PAD_W / 2 + 2) {
        const off = (b.x - this.px) / (PAD_W / 2);
        const smash = this.smashWindow > 0;
        const speed = Math.abs(b.vy) * (smash ? 1.35 : 1.04);
        b.vy = -Math.min(smash ? 260 : 200, Math.max(95, speed));
        b.vx = off * 90 + (Math.random() - 0.5) * 10;
        if (smash) {
          this.smashWindow = 0;
          this.smashes++;
          this.float('¡REMATE!', '#f8e070', this.px, myY - 14);
          playSfx('taco');
        } else playSfx('pinpon');
      }
    }
    if (b.y > myY + 12) {
      this.point('them');
      return;
    }
    // Paleta del rival.
    const oY = T.y - 4;
    if (b.vy < 0 && b.y <= oY + 3 && b.y >= oY - 6) {
      if (Math.abs(b.x - this.ox) <= PAD_W / 2 + 2) {
        const off = (b.x - this.ox) / (PAD_W / 2);
        b.vy = Math.min(230, Math.max(95, Math.abs(b.vy) * 1.03 * this.rival.hit));
        b.vx = off * 80 + (BASE_WIDTH / 2 - b.x) * 0.3 + (Math.random() - 0.5) * 40;
        playSfx('pinpon');
        if (Math.random() < 0.12) this.say(this.rival.taunts[Math.floor(Math.random() * this.rival.taunts.length)], this.ox, T.y - 6, 900);
      }
    }
    if (b.y < oY - 12) this.point('me');
  }

  private point(who: 'me' | 'them'): void {
    if (who === 'me') this.me++;
    else this.them++;
    this.float(who === 'me' ? '¡Punto!' : `Punto de ${this.rival.name}`, who === 'me' ? '#a8e0a0' : '#ff9c9c', BASE_WIDTH / 2, NET_Y);
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
    if (this.phase === 'play') {
      const b = this.ball;
      g.fillStyle(0x000000, 0.25).fillCircle(b.x + 1, b.y + 1, 2);
      g.fillStyle(0xf8f4ec, 1).fillCircle(b.x, b.y - b.z, 2);
    }
    const h = this.hud;
    h.clear();
    this.drawBars(h);
    this.scoreText.setText(`Tú ${this.me} – ${this.them} ${this.rival.name}   ·   Ganados: ${this.wins}`);
  }
}
