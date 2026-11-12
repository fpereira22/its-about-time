import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import { MiniScene } from './MiniScene';

/**
 * Misión 8: las atracciones del Parque del Café y el tejo de Salento, cada una con su mecánica:
 *  - `krater`: la montaña rusa, de lado. Sube con su clac-clac y después todo es caída. Cuando aparece
 *    «¡MANOS ARRIBA!» mantén E; cuando aparece «¡GRITA!», F. En la bajada grande está la cámara de la foto:
 *    cómo salgas depende de lo que estés haciendo justo en el flash. Flor va al lado.
 *  - `barco`: el Barco del Café. El vaivén crece; inclínate contra él (A cuando sube a la derecha, D cuando
 *    sube a la izquierda) para que no te dé mareo, o mantén W para mirar el horizonte. Renzo no tiene técnica.
 *  - `chocones`: los carros chocones desde arriba. W acelera, S frena (y retrocede), A/D giran. Chocar a otro
 *    con la trompa suma; 40 segundos.
 *  - `tejo`: en la cancha de tejo. E fija la puntería (la marca va y viene) y E otra vez lanza con la fuerza de la
 *    barra. Mecha = 3, bocín = 6, mecha y bocín (moñona) = 9. Cuatro tejos.
 * Esc salta la atracción (cuenta como que no te atreviste).
 */

export type AtraccionMode = 'krater' | 'barco' | 'chocones' | 'tejo';

export interface AtraccionResult {
  mode: AtraccionMode;
  /** Krater: aciertos (manos/grito); chocones: choques; tejo: puntos; barco: 0..3 según cuánto aguantaste. */
  score: number;
  /** Bien hecho para esa atracción (sin mareo, buena foto, ganador...). */
  good: boolean;
  /** Krater: cómo saliste en la foto. */
  photo?: 'manos' | 'grito' | 'panico';
  /** Chocones: le pegaste a Flor (ella se ríe y te persigue). */
  hitFlor?: boolean;
  /** Tejo: reventaste al menos una mecha. */
  mecha?: boolean;
  skipped: boolean;
}

export interface AtraccionSceneData {
  mode: AtraccionMode;
  done: (r: AtraccionResult) => void;
}

const SKIN = 0xf0c8a0;
const FLOR_HAIR = 0xd8b070;

// ---------------------------------------------------------------------------
// Krater
// ---------------------------------------------------------------------------

/** La pista: puntos (x, y) en px del mundo; el carro avanza en x. */
const TRACK: Array<[number, number]> = [
  [0, 140], [120, 140], [420, 30], [470, 26], [520, 40], [640, 160], [720, 150], [780, 90], [840, 60], [900, 90], [960, 150],
  [1040, 160], [1120, 110], [1180, 100], [1240, 120], [1320, 158], [1400, 120], [1460, 132], [1540, 150], [1700, 140], [1800, 140],
];
const KR_END = 1760;
const PHOTO_X = 600;
const PROMPTS: Array<{ x: number; kind: 'manos' | 'grito' }> = [
  { x: 545, kind: 'manos' },
  { x: 800, kind: 'grito' },
  { x: 1000, kind: 'manos' },
  { x: 1250, kind: 'grito' },
  { x: 1420, kind: 'manos' },
];

function trackY(x: number): number {
  for (let i = 1; i < TRACK.length; i++) {
    const [x0, y0] = TRACK[i - 1];
    const [x1, y1] = TRACK[i];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      const s = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return TRACK[TRACK.length - 1][1];
}

export class AtraccionScene extends MiniScene<AtraccionResult> {
  private mode: AtraccionMode = 'krater';
  private phase: 'intro' | 'play' | 'end' = 'intro';
  private score = 0;
  private skipped = false;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private elapsed = 0;

  // Krater
  private kx = 0;
  private kv = 0;
  private promptIdx = 0;
  private promptMs = 0;
  private promptOk = false;
  private lastScream = -9999;
  private photo: 'manos' | 'grito' | 'panico' | null = null;
  private flash = 0;

  // Barco
  private theta = 0;
  private omega = 0;
  private amp = 0.2;
  private nausea = 0;
  private renzo = 0;

  // Chocones
  private cars: Array<{ name: string; x: number; y: number; a: number; v: number; color: number; tx: number; ty: number; cool: number }> = [];
  private hitFlor = false;

  // Tejo
  private tejoStep: 'aim' | 'power' | 'fly' | 'show' = 'aim';
  private aim = 0;
  private aimDir = 1;
  private pow = 0;
  private powDir = 1;
  private throwN = 0;
  private fly = { t: 0, x: 0, y: 0, tx: 0, ty: 0 };
  private mechas = [true, true, true, true];
  private hits: Array<{ x: number; y: number }> = [];
  private mechaHit = false;

  constructor() {
    super('Atraccion');
  }

  init(data: AtraccionSceneData): void {
    this.initMini(data.done);
    this.mode = data.mode;
    this.phase = 'intro';
    this.score = 0;
    this.skipped = false;
    this.elapsed = 0;
    this.kx = 0;
    this.kv = 0;
    this.promptIdx = 0;
    this.promptMs = 0;
    this.photo = null;
    this.flash = 0;
    this.lastScream = -9999;
    this.theta = 0;
    this.omega = 0;
    this.amp = 0.2;
    this.nausea = 0;
    this.renzo = 0;
    this.hitFlor = false;
    this.tejoStep = 'aim';
    this.throwN = 0;
    this.mechas = [true, true, true, true];
    this.hits = [];
    this.mechaHit = false;
  }

  create(): void {
    this.g = this.add.graphics();
    this.hud = this.add.graphics().setDepth(40);
    this.createUi(this.mode === 'tejo' ? '#3a2c20' : '#7cb8e8');
    this.infoText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);
    this.promptText = this.addText(BASE_WIDTH / 2, 30, '', { fontSize: '12px', fontStyle: '600', color: '#f8e070', stroke: '#2a2433', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(52);
    playMusic(this.mode === 'tejo' ? 'billar' : 'parque');
    const intro: Record<AtraccionMode, [string, string, string]> = {
      krater: [
        'Krater · Parque del Café',
        'Mantén E con «¡MANOS ARRIBA!» · F con «¡GRITA!» · Esc: bajarte',
        'Flor: «¿Vos tenés miedo? Yo tampoco. Bueno, un toque.»\nEn la bajada grande está la cámara de la foto.\nMantén E para las manos arriba, F para gritar.\n(E para que arranque)',
      ],
      barco: [
        'Barco del Café',
        'A/D: inclinarte contra el vaivén · W: mirar el horizonte · Esc: bajarte',
        'Renzo: «Yo me subo, causa. Acabo de comer, pero me subo.»\nInclínate contra el vaivén (A cuando sube a la derecha, D cuando sube\na la izquierda) o mantén W para mirar el horizonte.\n(E para zarpar)',
      ],
      chocones: [
        'Carros chocones',
        'W acelerar · S frenar/retroceder · A/D girar · Esc: bajarte',
        'Meli: «¡A Flor no la choques que se enoja!» Flor: «¡Mentira! Chocame si podés.»\nChoca con la trompa del carro para sumar. 40 segundos.\n(E para arrancar)',
      ],
      tejo: [
        'Tejo · Los Compadres',
        'E fija la puntería · E lanza con la fuerza de la barra · Esc: dejar de jugar',
        'Juanpa: «El tejo es el deporte nacional, parce. Se tira el disco de metal a la\ncancha de greda: si revienta una mecha, ¡PUM! Mecha 3, bocín 6, moñona 9.»\n(E para el primer tejo)',
      ],
    };
    const [title, hint, text] = intro[this.mode];
    this.titleText.setText(title);
    this.hintText.setText(hint);
    this.banner(text);
    if (this.mode === 'chocones') this.setupCars();
    if (this.mode === 'tejo') this.promptText.setY(150).setFontSize(9);
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
      else if (this.mode === 'krater') this.krater(dt);
      else if (this.mode === 'barco') this.barco(dt);
      else if (this.mode === 'chocones') this.chocones(dt);
      else this.tejo(dt);
    } else if (this.phase === 'end') {
      if (Controls.consume('interact')) this.finish(this.result());
    }
    this.draw();
  }

  private skip(): void {
    this.skipped = true;
    this.phase = 'end';
    this.promptText.setText('');
    this.banner('Te bajaste. Nadie dice nada. Todos lo piensan.\n(E para seguir)');
  }

  private result(): AtraccionResult {
    const r: AtraccionResult = { mode: this.mode, score: this.score, good: false, skipped: this.skipped };
    if (this.mode === 'krater') {
      r.photo = this.photo ?? 'panico';
      r.good = !this.skipped && this.score >= 3;
    } else if (this.mode === 'barco') {
      r.good = !this.skipped && this.nausea < 100;
    } else if (this.mode === 'chocones') {
      r.hitFlor = this.hitFlor;
      r.good = !this.skipped && this.score >= 6;
    } else {
      r.mecha = this.mechaHit;
      r.good = !this.skipped && this.score >= 6;
    }
    return r;
  }

  private end(text: string): void {
    this.phase = 'end';
    this.promptText.setText('');
    this.banner(`${text}\n(E para seguir)`);
  }

  // -------------------------------------------------------------------------
  // Krater
  // -------------------------------------------------------------------------

  private krater(dt: number): void {
    const top = 26;
    const y = trackY(this.kx);
    if (this.kx < 470) {
      this.kv = 46;
      if (Math.floor(this.elapsed * 3) !== Math.floor((this.elapsed - dt) * 3)) playSfx('riel');
    } else {
      this.kv = Math.max(70, Math.sqrt(2 * 900 * Math.max(0, y - top)) * 0.9);
    }
    this.kx += this.kv * dt;
    if (Controls.consume('trick')) this.lastScream = this.elapsed;
    // La foto: lo que estés haciendo justo en el flash.
    if (!this.photo && this.kx >= PHOTO_X) {
      this.photo = Controls.isHeld('interact') ? 'manos' : this.elapsed - this.lastScream < 0.9 ? 'grito' : 'panico';
      this.flash = 1;
      playSfx('camera');
    }
    this.flash = Math.max(0, this.flash - dt * 2.5);
    // Avisos.
    const p = PROMPTS[this.promptIdx];
    if (p && this.kx >= p.x - 40) {
      if (this.promptMs === 0) {
        this.promptOk = false;
        this.promptText.setText(p.kind === 'manos' ? '¡MANOS ARRIBA! (mantén E)' : '¡GRITA! (F)');
      }
      this.promptMs += dt * 1000;
      if (p.kind === 'grito' && this.lastScream >= this.elapsed - this.promptMs / 1000) this.promptOk = true;
      if (p.kind === 'manos' && Controls.isHeld('interact') && this.promptMs > 500) this.promptOk = true;
      if (this.promptMs > 1300) {
        if (this.promptOk) {
          this.score++;
          this.float(p.kind === 'manos' ? '¡Sin manos!' : '¡AAAAAH!', '#f8e070', 120, 50);
        } else this.float('...', '#ff9c9c', 120, 50);
        this.promptText.setText('');
        this.promptMs = 0;
        this.promptIdx++;
      }
    }
    if (this.elapsed - this.lastScream < 0.1) this.say(Math.random() < 0.5 ? 'Flor: «¡AAAAH! ¡Boludo!»' : 'Flor: «¡JAJAJA! ¡NOOO!»', 150, 120, 900);
    if (this.kx >= KR_END) {
      const pose = { manos: 'con las manos arriba, como un campeón', grito: 'gritando con la boca enorme', panico: 'con cara de pánico total' }[this.photo ?? 'panico'];
      this.end(`¡Sobreviviste al Krater! ${this.score}/${PROMPTS.length}\nEn la foto sales ${pose}. Flor sale riéndose de ti.\nFlor: «Esa foto la compramos. Las dos. Una para cada uno.»`);
    }
  }

  // -------------------------------------------------------------------------
  // Barco
  // -------------------------------------------------------------------------

  private barco(dt: number): void {
    const T = 26;
    const t = this.elapsed;
    this.amp = t < T * 0.55 ? 0.25 + (t / (T * 0.55)) * 1.05 : Math.max(0.15, 1.3 - ((t - T * 0.55) / (T * 0.45)) * 1.1);
    const prev = this.theta;
    this.theta = this.amp * Math.sin(t * 1.9);
    this.omega = (this.theta - prev) / Math.max(dt, 0.001);
    const swing = Math.abs(this.omega) * 0.5 + Math.abs(this.theta) * 0.6;
    let gain = swing * 9;
    const leftH = Controls.isHeld('left');
    const rightH = Controls.isHeld('right');
    if (Controls.isHeld('up')) gain *= 0.55;
    else if (leftH || rightH) {
      const right = leftH && this.omega > 0.15;
      const leftOk = rightH && this.omega < -0.15;
      gain *= right || leftOk ? 0.25 : 1.8;
    }
    // Ayuda: hacia dónde conviene inclinarse ahora mismo.
    this.promptText.setText(Controls.isHeld('up') ? 'mirando el horizonte...' : this.omega > 0.15 ? '◀ A' : this.omega < -0.15 ? 'D ▶' : '');
    this.nausea = Math.min(100, this.nausea + gain * dt);
    this.nausea = Math.max(0, this.nausea - 3 * dt);
    this.renzo = Math.min(100, this.renzo + swing * 11 * dt);
    if (this.renzo > 70 && Math.random() < dt * 0.6) this.say('Renzo: «Causa... causa... el chicharrón...»', 210, 70, 900);
    if (this.nausea >= 100) {
      this.score = 0;
      this.end('Te mareaste. Te bajas verde como un aguacate.\nMeli: «Igual fuiste valiente. Verde, pero valiente.»');
      return;
    }
    if (t >= T) {
      this.score = this.nausea < 35 ? 3 : this.nausea < 70 ? 2 : 1;
      const renzo = this.renzo > 85 ? '\nRenzo se baja corriendo al baño. Nadie lo vuelve a ver en veinte minutos.' : '';
      this.end(`¡Aguantaste el Barco del Café! (mareo: ${Math.round(this.nausea)}%)${renzo}\nMeli: «Vos sos de fierro, chileno.»`);
    }
  }

  // -------------------------------------------------------------------------
  // Chocones
  // -------------------------------------------------------------------------

  private setupCars(): void {
    const mk = (name: string, x: number, y: number, a: number, color: number) => ({ name, x, y, a, v: 0, color, tx: x, ty: y, cool: 0 });
    this.cars = [
      mk('Tú', 80, 120, 0, 0x2c64c0),
      mk('Flor', 240, 60, Math.PI, 0xe868a8),
      mk('Meli', 240, 120, Math.PI, 0xf8dc68),
      mk('Juanpa', 160, 50, Math.PI / 2, 0x2c9c58),
      mk('Renzo', 160, 140, -Math.PI / 2, 0xe8742c),
    ];
  }

  private chocones(dt: number): void {
    const A = { x: 40, y: 32, w: 240, h: 130 };
    const me = this.cars[0];
    if (Controls.isHeld('left')) me.a -= 3 * dt;
    if (Controls.isHeld('right')) me.a += 3 * dt;
    if (Controls.isHeld('up')) me.v = Math.min(90, me.v + 140 * dt);
    else if (Controls.isHeld('down')) me.v = Math.max(-40, me.v - 160 * dt);
    else me.v *= 0.97;
    for (const c of this.cars.slice(1)) {
      c.cool = Math.max(0, c.cool - dt);
      if (Math.hypot(c.tx - c.x, c.ty - c.y) < 12 || Math.random() < dt * 0.4) {
        const chase = Math.random() < 0.45;
        c.tx = chase ? me.x : A.x + 15 + Math.random() * (A.w - 30);
        c.ty = chase ? me.y : A.y + 15 + Math.random() * (A.h - 30);
      }
      const want = Math.atan2(c.ty - c.y, c.tx - c.x);
      c.a += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - c.a), -2.2 * dt, 2.2 * dt);
      c.v = Math.min(c.name === 'Renzo' ? 45 : 65, c.v + 80 * dt);
    }
    for (const c of this.cars) {
      c.x += Math.cos(c.a) * c.v * dt;
      c.y += Math.sin(c.a) * c.v * dt;
      if (c.x < A.x + 7 || c.x > A.x + A.w - 7) (c.a = Math.PI - c.a), (c.x = Phaser.Math.Clamp(c.x, A.x + 7, A.x + A.w - 7)), (c.v *= 0.5);
      if (c.y < A.y + 7 || c.y > A.y + A.h - 7) (c.a = -c.a), (c.y = Phaser.Math.Clamp(c.y, A.y + 7, A.y + A.h - 7)), (c.v *= 0.5);
    }
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= 14 || d === 0) continue;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * (14 - d) / 2;
        a.y -= ny * (14 - d) / 2;
        b.x += nx * (14 - d) / 2;
        b.y += ny * (14 - d) / 2;
        if (i === 0 && a.v > 25 && Math.cos(a.a) * nx + Math.sin(a.a) * ny > 0.5 && b.cool <= 0) {
          this.score++;
          b.cool = 0.8;
          b.v = -30;
          this.float('¡BONK!', '#f8e070', b.x, b.y - 10);
          playSfx('chocon');
          this.cameras.main.shake(120, 0.004);
          if (b.name === 'Flor') {
            this.hitFlor = true;
            this.say('Flor: «¡Ah, no! ¡Ahora vas a ver!»', b.x, b.y - 12, 1200);
            b.tx = a.x;
            b.ty = a.y;
          }
        } else if (a.v > 10 || b.v > 10) {
          playSfx('golpe');
        }
        a.v *= 0.4;
        b.v *= 0.4;
      }
    }
    if (this.elapsed >= 40) {
      this.end(`¡Se acabó el tiempo! Choques: ${this.score}.${this.hitFlor ? '\nFlor: «Me chocaste tres veces. Lo voy a tomar como un coqueteo.»' : '\nFlor: «¿Y a mí no me chocaste? Qué desaire, che.»'}`);
    }
  }

  // -------------------------------------------------------------------------
  // Tejo
  // -------------------------------------------------------------------------

  private static readonly BOCIN = { x: 160, y: 62 };
  private static readonly MECHAS: Array<[number, number]> = [[160, 48], [178, 62], [160, 76], [142, 62]];

  private tejo(dt: number): void {
    if (this.tejoStep === 'aim') {
      this.aim += this.aimDir * dt * 1.4;
      if (Math.abs(this.aim) >= 1) this.aimDir *= -1;
      if (Controls.consume('interact')) {
        this.tejoStep = 'power';
        this.pow = 0;
        this.powDir = 1;
      }
    } else if (this.tejoStep === 'power') {
      this.pow += this.powDir * dt * 1.3;
      if (this.pow >= 1) (this.pow = 1), (this.powDir = -1);
      if (this.pow <= 0) (this.pow = 0), (this.powDir = 1);
      if (Controls.consume('interact')) {
        const B = AtraccionScene.BOCIN;
        this.fly = { t: 0, x: 160, y: 170, tx: B.x + this.aim * 46 + (Math.random() - 0.5) * 4, ty: B.y + (0.62 - this.pow) * 90 + (Math.random() - 0.5) * 4 };
        this.tejoStep = 'fly';
        playSfx('salto');
      }
    } else if (this.tejoStep === 'fly') {
      this.fly.t += dt * 1.4;
      if (this.fly.t >= 1) {
        this.tejoStep = 'show';
        this.landTejo();
      }
    } else if (this.tejoStep === 'show' && Controls.consume('interact')) {
      this.throwN++;
      if (this.throwN >= 4) {
        const verdict = this.score >= 9 ? '¡Juanpa: «Parce, ¿usted seguro es chileno? ¡Eso es de boyacense!»' : this.score >= 3 ? 'Juanpa: «Nada mal pa\' ser la primera vez.»' : 'Juanpa: «Tranquilo, el tejo es más de cerveza que de puntería.»';
        this.end(`Puntos: ${this.score}.\n${verdict}`);
      } else this.tejoStep = 'aim';
    }
  }

  private landTejo(): void {
    const { tx, ty } = this.fly;
    this.hits.push({ x: tx, y: ty });
    const B = AtraccionScene.BOCIN;
    let pts = 0;
    let text = '';
    let mecha = false;
    AtraccionScene.MECHAS.forEach(([mx, my], i) => {
      if (this.mechas[i] && Math.hypot(tx - mx, ty - my) < 7) {
        this.mechas[i] = false;
        mecha = true;
      }
    });
    const bocin = Math.hypot(tx - B.x, ty - B.y) < 6;
    if (mecha && bocin) (pts = 9), (text = '¡¡MOÑONA!!');
    else if (bocin) (pts = 6), (text = '¡Embocinada!');
    else if (mecha) (pts = 3), (text = '¡MECHA!');
    else if (Math.hypot(tx - B.x, ty - B.y) < 30) text = 'Cerquita...';
    else text = ty < 20 || ty > 110 ? 'Se fue de la cancha.' : 'En la greda. Nada.';
    if (mecha) {
      this.mechaHit = true;
      playSfx('mecha');
      this.flash = 1;
      this.cameras.main.shake(260, 0.01);
    } else playSfx('golpe');
    this.score += pts;
    this.float(text, pts ? '#f8e070' : '#dfe6f4', tx, ty - 12, 1.4);
    if (this.mechas.every((m) => !m)) this.mechas = [true, true, true, true];
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private draw(): void {
    const g = this.g;
    g.clear();
    if (this.mode === 'krater') this.drawKrater(g);
    else if (this.mode === 'barco') this.drawBarco(g);
    else if (this.mode === 'chocones') this.drawChocones(g);
    else this.drawTejo(g);
    if (this.flash > 0) g.fillStyle(0xffffff, this.flash * 0.8).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    const h = this.hud;
    h.clear();
    this.drawBars(h);
    if (this.mode === 'barco' && this.phase === 'play') {
      h.fillStyle(0x0c1020, 0.8).fillRect(8, 24, 70, 18);
      h.fillStyle(0x3a4060, 1).fillRect(12, 34, 62, 4);
      h.fillStyle(this.nausea > 70 ? 0x9cc848 : this.nausea > 40 ? 0xf8e070 : 0x5cc880, 1).fillRect(12, 34, Math.round(0.62 * this.nausea), 4);
    }
    this.infoText.setText(
      this.mode === 'krater'
        ? `Valentía: ${this.score}/${PROMPTS.length}`
        : this.mode === 'barco'
          ? 'Mareo'
          : this.mode === 'chocones'
            ? `Choques: ${this.score} · ${Math.max(0, Math.ceil(40 - this.elapsed))} s`
            : `Tejo ${Math.min(4, this.throwN + 1)}/4 · Puntos: ${this.score}`,
    );
  }

  /** Cabecita de perfil con pelo (para los que van en los carros). */
  private head(g: Phaser.GameObjects.Graphics, x: number, y: number, hair: number, long = false): void {
    g.fillStyle(0x2a2433, 1).fillCircle(x, y, 5);
    g.fillStyle(SKIN, 1).fillCircle(x, y, 4);
    g.fillStyle(hair, 1).fillRect(x - 4, y - 5, 8, 3);
    if (long) g.fillRect(x - 5, y - 3, 3, 9);
  }

  private drawKrater(g: Phaser.GameObjects.Graphics): void {
    const cam = Phaser.Math.Clamp(this.kx - 120, 0, KR_END);
    // Cielo de la tarde y las montañas del Quindío.
    g.fillStyle(0x9cd0f0, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    g.fillStyle(0xc8e4f4, 1).fillRect(0, 90, BASE_WIDTH, 40);
    for (let i = 0; i < 8; i++) {
      const mx = ((i * 90 - cam * 0.2) % 720) - 60;
      g.fillStyle(0x5c9c4c, 1).fillTriangle(mx, 140, mx + 70, 70 + (i % 3) * 12, mx + 140, 140);
    }
    g.fillStyle(0x4c8c3c, 1).fillRect(0, 150, BASE_WIDTH, 40);
    // Soportes y riel.
    for (let x = Math.floor(cam / 20) * 20; x < cam + BASE_WIDTH + 20; x += 20) {
      const y = trackY(x);
      g.fillStyle(0x8c1c28, 1).fillRect(x - cam, y + 4, 2, 180 - y);
      g.fillStyle(0xa82830, 1).fillRect(x - cam - 6, y + 20, 14, 1);
    }
    for (let x = cam - 4; x < cam + BASE_WIDTH + 4; x += 2) {
      const y = trackY(x);
      g.fillStyle(0xc8303c, 1).fillRect(x - cam, y, 2, 3);
      g.fillStyle(0x6a6c78, 1).fillRect(x - cam, y + 3, 2, 1);
    }
    // La cámara de la foto (un poste con flash).
    const pxs = PHOTO_X - cam;
    if (pxs > -10 && pxs < BASE_WIDTH + 10) {
      g.fillStyle(0x3a3a48, 1).fillRect(pxs - 1, trackY(PHOTO_X) - 40, 2, 30).fillRect(pxs - 5, trackY(PHOTO_X) - 46, 10, 7);
      g.fillStyle(0xf8e070, 1).fillRect(pxs + 2, trackY(PHOTO_X) - 44, 2, 2);
    }
    // El carro.
    const cx = this.kx - cam;
    const cy = trackY(this.kx);
    const ang = Math.atan2(trackY(this.kx + 4) - trackY(this.kx - 4), 8);
    g.save();
    g.translateCanvas(cx, cy);
    g.rotateCanvas(ang);
    g.fillStyle(0x2a2433, 1).fillRect(-17, -11, 34, 10);
    g.fillStyle(0xc8303c, 1).fillRect(-16, -10, 32, 8);
    g.fillStyle(0xf8e070, 1).fillRect(-16, -10, 32, 2);
    const handsUp = Controls.isHeld('interact') && this.phase === 'play';
    const scream = this.elapsed - this.lastScream < 0.6;
    this.head(g, 6, -15, 0x3a2418);
    this.head(g, -6, -15, FLOR_HAIR, true);
    if (scream) g.fillStyle(0x7a2a2a, 1).fillRect(8, -14, 2, 3);
    if (handsUp) g.fillStyle(SKIN, 1).fillRect(3, -30, 2, 10).fillRect(9, -30, 2, 10);
    g.fillStyle(SKIN, 1).fillRect(-9, -24, 2, 6);
    g.restore();
  }

  private drawBarco(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x9cd0f0, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    // El horizonte (se mueve al revés del barco para que se note el vaivén).
    const tilt = this.theta * 0.25;
    g.fillStyle(0x5c9c4c, 1).fillTriangle(0, 150 + tilt * 60, BASE_WIDTH, 150 - tilt * 60, BASE_WIDTH, 180);
    g.fillTriangle(0, 150 + tilt * 60, 0, 180, BASE_WIDTH, 180);
    const px = BASE_WIDTH / 2;
    const py = 26;
    g.fillStyle(0x8c8c98, 1).fillRect(px - 60, py - 2, 4, 160).fillRect(px + 56, py - 2, 4, 160).fillRect(px - 60, py - 4, 120, 4);
    const L = 92;
    const bx = px + Math.sin(this.theta) * L;
    const by = py + Math.cos(this.theta) * L;
    g.lineStyle(3, 0x5a5a68, 1).lineBetween(px, py, bx, by);
    g.save();
    g.translateCanvas(bx, by);
    g.rotateCanvas(-this.theta);
    g.fillStyle(0x2a2433, 1).fillRect(-62, -6, 124, 24);
    g.fillStyle(0x8c4c24, 1).fillRect(-60, -4, 120, 20);
    g.fillStyle(0xe8b828, 1).fillRect(-60, -4, 120, 3);
    g.fillStyle(0x8c4c24, 1).fillRect(-70, -12, 14, 14).fillRect(56, -12, 14, 14);
    for (let i = -48; i <= 40; i += 22) g.fillStyle(0x3a2010, 1).fillRect(i, 4, 6, 6);
    this.head(g, -8, -10, 0x3a2418);
    this.head(g, 8, -10, 0x1c1418);
    this.head(g, 24, -10, 0x6a3c1c, true);
    if (this.renzo > 70) g.fillStyle(0x9cc848, 1).fillCircle(8, -10, 3);
    g.restore();
  }

  private drawChocones(g: Phaser.GameObjects.Graphics): void {
    const A = { x: 40, y: 32, w: 240, h: 130 };
    g.fillStyle(0x2a2433, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    g.fillStyle(0xe8b828, 1).fillRect(A.x - 6, A.y - 6, A.w + 12, A.h + 12);
    for (let x = A.x - 6; x < A.x + A.w + 6; x += 12) g.fillStyle(0x1c1824, 1).fillRect(x, A.y - 6, 6, 6).fillRect(x, A.y + A.h, 6, 6);
    g.fillStyle(0x5a5a68, 1).fillRect(A.x, A.y, A.w, A.h);
    for (let y = A.y; y < A.y + A.h; y += 10) for (let x = A.x; x < A.x + A.w; x += 10) g.fillStyle(0x6c6c7c, 1).fillRect(x + 1, y + 1, 1, 1);
    for (const c of this.cars) {
      g.fillStyle(0x2a2433, 1).fillCircle(c.x, c.y, 8);
      g.fillStyle(c.color, 1).fillCircle(c.x, c.y, 7);
      g.fillStyle(0x1c1824, 1).fillCircle(c.x + Math.cos(c.a) * 4, c.y + Math.sin(c.a) * 4, 2);
      g.lineStyle(1, 0x8c8c98, 1).lineBetween(c.x, c.y, c.x, c.y - 14);
      g.fillStyle(0xf8e070, 1).fillCircle(c.x, c.y - 14, 1);
    }
    // Nombres arriba de cada carro (sin crear textos por frame: con puntitos de color).
    for (const c of this.cars) if (c.name === 'Flor') g.fillStyle(0xe868a8, 1).fillTriangle(c.x - 3, c.y - 22, c.x + 3, c.y - 22, c.x, c.y - 18);
    const me = this.cars[0];
    if (me) g.fillStyle(0xffffff, 1).fillTriangle(me.x - 4, me.y - 24, me.x + 4, me.y - 24, me.x, me.y - 19);
  }

  private drawTejo(g: Phaser.GameObjects.Graphics): void {
    const B = AtraccionScene.BOCIN;
    g.fillStyle(0x3a2c20, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    // La cancha de greda inclinada, con su marco de madera.
    g.fillStyle(0x6a4428, 1).fillRect(B.x - 66, B.y - 46, 132, 96);
    g.fillStyle(0x8c7c64, 1).fillRect(B.x - 60, B.y - 40, 120, 84);
    for (let i = 0; i < 30; i++) g.fillStyle(0x7a6a54, 1).fillRect(B.x - 58 + ((i * 37) % 116), B.y - 38 + ((i * 23) % 80), 2, 1);
    g.lineStyle(2, 0xc8c8d0, 1).strokeCircle(B.x, B.y, 7);
    AtraccionScene.MECHAS.forEach(([mx, my], i) => {
      if (!this.mechas[i]) return;
      g.fillStyle(0xf4f0e6, 1).fillTriangle(mx - 5, my + 3, mx + 5, my + 3, mx, my - 5);
      g.fillStyle(0xc8303c, 1).fillTriangle(mx - 2, my + 1, mx + 2, my + 1, mx, my - 2);
    });
    for (const h of this.hits) g.fillStyle(0x5a5a68, 1).fillEllipse(h.x, h.y, 8, 4);
    // El que lanza (de espaldas, abajo).
    g.fillStyle(0x2a2433, 1).fillCircle(160, 168, 10);
    g.fillStyle(0x2c64c0, 1).fillCircle(160, 168, 9);
    if (this.tejoStep === 'aim' || this.tejoStep === 'power') {
      const ax = B.x + this.aim * 46;
      g.lineStyle(1, 0xf8e070, 0.9).lineBetween(160, 158, ax, B.y + 40);
      g.fillStyle(0xf8e070, 1).fillTriangle(ax - 3, B.y + 46, ax + 3, B.y + 46, ax, B.y + 41);
    }
    if (this.tejoStep === 'power') {
      g.fillStyle(0x0c1020, 0.85).fillRect(270, 40, 12, 104);
      const p = Math.round(this.pow * 100);
      g.fillStyle(0xf8e070, 1).fillRect(272, 142 - p, 8, p);
      g.fillStyle(0xffffff, 1).fillRect(268, 142 - 62, 16, 1);
    }
    if (this.tejoStep === 'fly') {
      const t = this.fly.t;
      const x = this.fly.x + (this.fly.tx - this.fly.x) * t;
      const y = this.fly.y + (this.fly.ty - this.fly.y) * t - Math.sin(t * Math.PI) * 40;
      const s = 6 - t * 3;
      g.fillStyle(0x2a2433, 1).fillEllipse(x, y, s * 2 + 1, s + 1);
      g.fillStyle(0x8c8c98, 1).fillEllipse(x, y, s * 2, s);
    }
    if (this.tejoStep === 'show' && this.phase === 'play') this.promptText.setText('(E: siguiente tejo)');
    else if (this.phase === 'play') this.promptText.setText('');
  }
}
