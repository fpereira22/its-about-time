import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import { buildKrater, buildYippe, STEP, type CoasterPath, type ZoneSpan } from './coaster';
import { MiniScene } from './MiniScene';
import type { ParqueMode } from './ParqueScene';

/**
 * Misión 8: las atracciones del Parque del Café y el tejo de Salento, cada una con su mecánica:
 *  - `krater`: la montaña rusa, de lado (pista en src/scenes/coaster.ts): la cadena eterna, la caída con la
 *    cámara de la foto, loop, lomas de airtime, la pasada rasante por el cafetal, la segunda cadena por la ladera
 *    del volcán, el túnel del cráter, el doble loop, el sacacorchos, la hélice y los frenos. «¡MANOS ARRIBA!»:
 *    mantén E; «¡GRITA!»: F; «¡AGACHA LA CABEZA!»: mantén S. Cómo sales en la foto depende de lo que estés
 *    haciendo justo en el flash. Flor va al lado; Juanpa y Meli atrás.
 *  - `yippe`: la montaña rusa de los niños, con Renzo. La misma mecánica, más cortita.
 *  - `barco`: el Barco del Café. El vaivén crece; inclínate contra él (A cuando sube a la derecha, D cuando
 *    sube a la izquierda) para que no te dé mareo, o mantén W para mirar el horizonte. Renzo no tiene técnica.
 *  - `chocones`: los carros chocones desde arriba. W acelera, S frena (y retrocede), A/D giran. Chocar a otro
 *    con la trompa suma; 40 segundos.
 *  - `tejo`: en la cancha de tejo. E fija la puntería (la marca va y viene) y E otra vez lanza con la fuerza de la
 *    barra. Mecha = 3, bocín = 6, mecha y bocín (moñona) = 9. Cuatro tejos.
 * Esc salta la atracción (cuenta como que no te atreviste).
 */

/** Las de esta escena. */
type OwnMode = 'krater' | 'yippe' | 'barco' | 'chocones' | 'tejo';
/** Todas las atracciones de la misión 8: las de esta escena, las de ParqueScene y el cafetal (CafeScene). */
export type AtraccionMode = OwnMode | ParqueMode | 'cafe';

/** Qué escena corre cada atracción. */
export function atraccionScene(mode: AtraccionMode): 'Atraccion' | 'Parque' | 'Cafe' {
  if (mode === 'cafe') return 'Cafe';
  return ['krater', 'yippe', 'barco', 'chocones', 'tejo'].includes(mode) ? 'Atraccion' : 'Parque';
}

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
  /** Rápidos: cuánto te mojaste (0..100) y si por fin se mojó Renzo. */
  wet?: number;
  renzoWet?: boolean;
  /** Teleférico / Rueda / Torre: ids de las fotos que sacaste; Rueda: selfie con Flor. */
  photos?: string[];
  selfie?: boolean;
  /** Cafetal: cómo quedó tu café (ver CafeScene). */
  cafe?: { calidad: number; tueste: string; nota: string };
  skipped: boolean;
}

export interface AtraccionSceneData {
  mode: AtraccionMode;
  done: (r: AtraccionResult) => void;
}

const SKIN = 0xf0c8a0;
const FLOR_HAIR = 0xd8b070;

// ---------------------------------------------------------------------------
// Montañas rusas
// ---------------------------------------------------------------------------

/** La cuenta regresiva de la estación antes de que arranque el tren. */
const DISPATCH_MS = 2600;
/** Gravedad (px/s²) y cuánta energía se pierde por px de riel (la altura de referencia sube). */
const GRAV = 110;
const LOSS = 0.025;

type PromptKind = 'manos' | 'grito' | 'agacha';
const PROMPT_TEXT: Record<PromptKind, string> = {
  manos: '¡MANOS ARRIBA! (mantén E)',
  grito: '¡GRITA! (F)',
  agacha: '¡AGACHA LA CABEZA! (mantén S)',
};

export class AtraccionScene extends MiniScene<AtraccionResult> {
  private mode: OwnMode = 'krater';
  private phase: 'intro' | 'play' | 'end' = 'intro';
  private score = 0;
  private skipped = false;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private elapsed = 0;

  // Montañas rusas
  private path!: CoasterPath;
  /** Posición (px de riel) y velocidad (px/s) del carro de adelante. */
  private cs = 0;
  private cv = 0;
  private refY = 0;
  private refS = 0;
  private dispatchMs = 0;
  private camX = 0;
  private camY = 0;
  private airCool = 0;
  private kmh = 0;
  /** Una rama del cafetal te despeinó (no te agachaste). */
  private goggles = false;
  private prompts: Array<{ s: number; kind: PromptKind }> = [];
  private lines: Array<{ s: number; text: string }> = [];
  private lineIdx = 0;
  private promptIdx = 0;
  private promptMs = 0;
  private promptOk = false;
  private promptHeld = 0;
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
    this.mode = data.mode as OwnMode;
    this.phase = 'intro';
    this.score = 0;
    this.skipped = false;
    this.elapsed = 0;
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
    const intro: Record<OwnMode, [string, string, string]> = {
      krater: [
        'Krater · Parque del Café',
        'E: manos arriba · F: gritar · S: agacharse · Esc: bajarte',
        'Krater: 380 metros de riel, dos cadenas, tres loops y un volcán.\nEn la primera bajada está la cámara de la foto.\nMantén E para las manos arriba, F para gritar, mantén S para agacharte.\n(E para sentarte con Flor)',
      ],
      yippe: [
        'Yippe · Parque del Café',
        'E: manos arriba · F: gritar · Esc: bajarte',
        'El Yippe: la montaña rusa de los niños. Renzo se sienta adelante, contigo.\nRenzo: «Es para niños, causa. ¿Qué tan malo puede ser?»\nMantén E para las manos arriba, F para gritar.\n(E para arrancar)',
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
    if (this.mode === 'krater' || this.mode === 'yippe') this.setupCoaster();
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
      else if (this.mode === 'krater' || this.mode === 'yippe') this.coaster(dt);
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
      r.good = !this.skipped && this.score >= 6;
    } else if (this.mode === 'yippe') {
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
  // Montañas rusas (Krater y Yippe)
  // -------------------------------------------------------------------------

  private setupCoaster(): void {
    const yippe = this.mode === 'yippe';
    this.path = yippe ? buildYippe() : buildKrater();
    const P = this.path;
    const at = (m: string, d = 0): number => P.mark(m) + d;
    this.prompts = yippe
      ? [
          { s: at('drop', -10), kind: 'manos' },
          { s: at('hops', 40), kind: 'grito' },
          { s: at('helix', 20), kind: 'manos' },
          { s: at('hops2', 0), kind: 'grito' },
        ]
      : [
          { s: at('drop', -24), kind: 'manos' },
          { s: at('loop1', -30), kind: 'grito' },
          { s: at('hills', 130), kind: 'manos' },
          { s: at('low', 10), kind: 'agacha' },
          { s: at('crater', -10), kind: 'grito' },
          { s: at('loop2', -20), kind: 'manos' },
          { s: at('cork', 0), kind: 'grito' },
          { s: at('helix', 30), kind: 'manos' },
          { s: at('hops', 0), kind: 'grito' },
        ];
    this.lines = yippe
      ? [
          { s: 0, text: 'Renzo: «Este es el mío, causa. El de mi tamaño emocional.»' },
          { s: P.mark('drop') - 120, text: 'Renzo: «¿Por qué sube tanto? ¡Dijeron que era para niños!»' },
          { s: P.mark('drop') + 20, text: 'Renzo: «¡MAMÁÁÁÁÁ!»' },
          { s: P.mark('helix') + 60, text: 'Niño de atrás: «Señor, ¿por qué grita?»' },
          { s: P.length - 300, text: 'Renzo: «Otra vez. No. Sí. Otra vez.»' },
        ]
      : [
          { s: 0, text: 'Operario: «¡Brazos adentro, gafas guardadas y el alma bien amarrada!»' },
          { s: 260, text: 'Flor: «¿Vos tenés miedo? Yo tampoco. Bueno, un toque.»' },
          { s: 420, text: 'Flor: «Mirá: la Rueda, el cafetal... ¡y Renzo cuidando las mochilas!»' },
          { s: P.mark('drop') - 60, text: 'Flor: «Ay. Ay, no. AY NO.»' },
          { s: P.mark('low') + 200, text: 'Juanpa: «¡Parce, casi nos comemos un cafeto!»' },
          { s: P.mark('lift2') + 60, text: 'Juanpa: «¡Ese es el cráter, parce! ¡Por eso se llama Krater!»' },
          { s: P.mark('lift2') + 220, text: 'Meli: «¿Alguien vio mi mate? Lo traía acá.»' },
          { s: P.mark('helix') + 40, text: 'Flor: «¡JAJAJA! ¡No siento la cara!»' },
          { s: P.length - 320, text: 'Flor: «¡OTRA VEZ! ...No, mentira. Necesito sentarme.»' },
        ];
    this.cs = 0;
    this.cv = 0;
    this.refY = P.at(0).y;
    this.refS = 0;
    this.dispatchMs = 0;
    this.lineIdx = 0;
    this.camX = -120;
    this.camY = 0;
    this.airCool = 0;
    this.kmh = 0;
    this.goggles = false;
  }

  private coaster(dt: number): void {
    const P = this.path;
    if (this.dispatchMs < DISPATCH_MS) {
      const before = this.dispatchMs;
      this.dispatchMs += dt * 1000;
      for (const [ms, label] of [[600, '3'], [1200, '2'], [1800, '1'], [2400, '¡VAMOS!']] as const) {
        if (before < ms && this.dispatchMs >= ms) {
          this.promptText.setText(label);
          playSfx(label === '¡VAMOS!' ? 'silbato' : 'cursor');
        }
      }
      this.sayLines();
      return;
    }
    if (this.promptText.text === '¡VAMOS!' && this.dispatchMs > DISPATCH_MS + 600) this.promptText.setText('');
    this.dispatchMs += dt * 1000;
    const here = P.at(this.cs);
    const zone = P.zone(this.cs)?.kind;
    const leaving = this.cs < P.length / 2;
    if (zone === 'station' && leaving) this.cv = Math.min(52, this.cv + 50 * dt);
    else if (zone === 'lift') {
      this.cv = this.mode === 'yippe' ? 42 : 54;
      this.refY = here.y - 14;
      this.refS = this.cs;
      if (Math.floor(this.elapsed * 3.2) !== Math.floor((this.elapsed - dt) * 3.2)) playSfx('riel');
    } else if (zone === 'brake' || zone === 'station') {
      this.cv = Math.max(zone === 'station' ? 0 : 24, this.cv - (zone === 'station' ? 60 : 160) * dt);
    } else {
      const yref = this.refY + LOSS * (this.cs - this.refS);
      this.cv = Phaser.Math.Clamp(Math.sqrt(2 * GRAV * Math.max(0, here.y - yref)), 36, 330);
    }
    this.cs += this.cv * dt;
    this.kmh = Math.round(this.cv * 0.33);
    if (Controls.consume('trick')) {
      this.lastScream = this.elapsed;
      playSfx('salto');
    }
    // Airtime (en las crestas) y el golpe de los valles.
    const k = P.curvature(this.cs);
    this.airCool = Math.max(0, this.airCool - dt);
    if (k < -0.01 && this.cv > 120 && this.airCool <= 0 && zone !== 'loop') {
      this.airCool = 1.4;
      this.float('¡AIRTIME!', '#9cf0ff', 150, 70);
    }
    if (k * this.cv * this.cv > 900 && zone !== 'loop' && Math.random() < 0.3) this.cameras.main.shake(90, 0.006);
    if (zone === 'tunnel' && Math.random() < dt * 2) this.cameras.main.shake(120, 0.004);
    // La foto: lo que estés haciendo justo en el flash.
    if (this.mode === 'krater' && !this.photo && this.cs >= P.mark('photo')) {
      this.photo = Controls.isHeld('interact') ? 'manos' : this.elapsed - this.lastScream < 0.9 ? 'grito' : 'panico';
      this.flash = 1;
      playSfx('camera');
    }
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.sayLines();
    this.coasterPrompts(dt);
    // Cámara: sigue al carro también para arriba (la subida se va al cielo).
    const tx = here.x - 130;
    const ty = Phaser.Math.Clamp(here.y - 108, -320, 0);
    const kc = Math.min(1, dt * 5);
    this.camX += (tx - this.camX) * kc;
    this.camY += (ty - this.camY) * kc;
    if (this.cs >= P.length - 6 || (!leaving && zone === 'station' && this.cv <= 0.5)) this.endCoaster();
  }

  private sayLines(): void {
    const line = this.lines[this.lineIdx];
    if (!line || this.cs < line.s) return;
    this.lineIdx++;
    const p = this.path.at(this.cs);
    this.say(line.text, p.x - this.camX, Math.max(40, p.y - this.camY - 26), 2200);
  }

  private coasterPrompts(dt: number): void {
    const p = this.prompts[this.promptIdx];
    if (!p || this.cs < p.s) return;
    if (this.promptMs === 0) {
      this.promptOk = false;
      this.promptHeld = 0;
      this.promptText.setText(PROMPT_TEXT[p.kind]);
    }
    this.promptMs += dt * 1000;
    if (p.kind === 'grito' && this.lastScream >= this.elapsed - this.promptMs / 1000) this.promptOk = true;
    if (p.kind === 'manos' && Controls.isHeld('interact')) this.promptHeld += dt;
    if (p.kind === 'agacha' && Controls.isHeld('down')) this.promptHeld += dt;
    if (p.kind !== 'grito' && this.promptHeld > 0.35) this.promptOk = true;
    if (this.promptMs > 1400) {
      if (this.promptOk) {
        this.score++;
        this.float({ manos: '¡Sin manos!', grito: '¡AAAAAH!', agacha: '¡Uf! Por un pelo.' }[p.kind], '#f8e070', 150, 50);
      } else {
        this.float(p.kind === 'agacha' ? 'Una rama de cafeto te despeina.' : '...', '#ff9c9c', 150, 50);
        if (p.kind === 'agacha') this.goggles = true;
      }
      this.promptText.setText('');
      this.promptMs = 0;
      this.promptIdx++;
    }
  }

  private endCoaster(): void {
    if (this.mode === 'yippe') {
      const verdict = this.score >= 3 ? 'Renzo se baja temblando y feliz: «Lo superé. Bueno, lo sobreviví.»' : 'Renzo se baja y se sienta en el piso. «Necesito un momento, causa. Uno largo.»';
      this.end(`¡Sobreviviste al Yippe! ${this.score}/${this.prompts.length}\n${verdict}\nUna niña de siete años los mira con lástima.`);
      return;
    }
    const pose = { manos: 'con las manos arriba, como un campeón', grito: 'gritando con la boca enorme', panico: 'con cara de pánico total' }[this.photo ?? 'panico'];
    const pelo = this.goggles ? '\nTienes una hoja de café en el pelo. Flor no te la saca: «Te queda bien.»' : '';
    this.end(`¡Sobreviviste al Krater! Valentía: ${this.score}/${this.prompts.length}\nEn la foto sales ${pose}. Flor sale riéndose de ti.${pelo}\nFlor: «Esa foto la compramos. Las dos. Una para cada uno.»`);
  }

  // Dibujo de las montañas rusas ------------------------------------------------

  private drawCoaster(g: Phaser.GameObjects.Graphics): void {
    const P = this.path;
    const cx = this.camX;
    const cy = this.camY;
    const yippe = this.mode === 'yippe';
    const W = BASE_WIDTH;
    const H = BASE_HEIGHT;
    // Cielo de la tarde, el sol y las nubes.
    const bands = [0x7cbce8, 0x8cc6ec, 0x9ccff0, 0xb0d8f0, 0xc8e0ec, 0xe4e0d0, 0xf4d8b0];
    bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, Math.floor((i * H) / bands.length), W, Math.ceil(H / bands.length) + 1));
    g.fillStyle(0xfff4c8, 0.5).fillCircle(262, 34 - cy * 0.05, 16);
    g.fillStyle(0xfff8e0, 1).fillCircle(262, 34 - cy * 0.05, 11);
    for (let i = 0; i < 7; i++) {
      const x = ((i * 137 - cx * 0.08) % 440) - 60 + (i % 2) * 30;
      const y = 18 + (i % 3) * 22 - cy * 0.08;
      g.fillStyle(0xffffff, 0.85).fillEllipse(x, y, 34, 9).fillEllipse(x + 12, y - 4, 22, 9);
    }
    // La cordillera (con el nevado) y los cerros cafeteros.
    const far = 120 - cy * 0.12;
    for (let i = -1; i < 7; i++) {
      const x = i * 90 - ((cx * 0.12) % 90);
      const h = 34 + ((i * 37) % 5) * 7;
      g.fillStyle(0x7a9cb8, 1).fillTriangle(x - 60, far + 30, x, far - h, x + 60, far + 30);
      if (((i + Math.floor((cx * 0.12) / 90)) % 4 + 4) % 4 === 1) g.fillStyle(0xf4f4f8, 1).fillTriangle(x - 12, far - h + 10, x, far - h, x + 12, far - h + 10);
    }
    const mid = 142 - cy * 0.3;
    for (let i = -1; i < 6; i++) {
      const x = i * 80 - ((cx * 0.3) % 80);
      g.fillStyle(0x5c9c4c, 1).fillEllipse(x + 40, mid + 12, 130, 60);
      for (let r = 0; r < 4; r++) g.fillStyle(0x4c8c3c, 1).fillRect(x + 4 + r * 4, mid - 8 + r * 7, 70 - r * 8, 2);
    }
    // El parque a lo lejos: la Rueda y las torres del teleférico (solo en el Krater).
    if (!yippe) {
      const rx = 560 - cx * 0.3;
      const ry = mid - 22;
      if (rx > -40 && rx < W + 40) {
        g.lineStyle(1, 0xe8e8f0, 1).strokeCircle(rx, ry, 18);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + this.elapsed * 0.2;
          g.lineBetween(rx, ry, rx + Math.cos(a) * 18, ry + Math.sin(a) * 18);
          g.fillStyle([0xe8303c, 0xf8e070, 0x2c9cd8, 0x48b860][k % 4], 1).fillRect(rx + Math.cos(a) * 18 - 2, ry + Math.sin(a) * 18, 4, 4);
        }
        g.fillStyle(0x8c8c98, 1).fillTriangle(rx - 10, ry + 30, rx, ry, rx + 10, ry + 30);
      }
      const tx = 1500 - cx * 0.3;
      if (tx > -200 && tx < W + 200) {
        g.lineStyle(1, 0x3a3a48, 1).lineBetween(tx - 160, mid - 30, tx + 160, mid - 50);
        const c = ((this.elapsed * 12) % 320) - 160;
        g.fillStyle(0xf8d030, 1).fillRect(tx + c - 3, mid - 30 - ((c + 160) / 320) * 20 + 2, 6, 6);
      }
    }
    // El volcán del Krater (detrás de la pista): la segunda cadena sube por su ladera.
    if (!yippe) this.drawVolcano(g, false);
    // El suelo.
    const gy = P.ground - cy;
    if (gy < H) {
      g.fillStyle(0x4c8c3c, 1).fillRect(0, gy, W, H - gy);
      g.fillStyle(0x5c9c4c, 1).fillRect(0, gy, W, 3);
      for (let x = -((cx | 0) % 24); x < W; x += 24) g.fillStyle(0x3c7c34, 1).fillRect(x, gy + 6, 8, 2);
    }
    this.drawStations(g, false);
    // Soportes.
    const ptsN = P.pts.length;
    for (let i = 0; i < ptsN; i += 8) {
      const p = P.pts[i];
      const sx = p.x - cx;
      if (sx < -10 || sx > W + 10) continue;
      const z = P.zone(i * STEP)?.kind;
      if (z === 'loop' || z === 'tunnel' || z === 'station' || p.y > P.ground - 8) continue;
      const sy = p.y - cy;
      const h = P.ground - p.y;
      g.fillStyle(yippe ? 0x2c64c0 : 0x5a1c24, 1).fillRect(sx - 1, sy + 3, 2, h);
      if (i % 16 === 0) for (let k = 18; k < h; k += 22) g.fillRect(sx - 5, sy + k, 10, 1);
    }
    // Riel: base oscura, el riel de color y los durmientes.
    const rail = yippe ? 0xf8c830 : 0xd8303c;
    for (const [w, c, off] of [[4, 0x2a1418, 0], [2, rail, -1]] as const) {
      g.lineStyle(w, c, 1);
      g.beginPath();
      let drawing = false;
      for (let i = 0; i < ptsN; i++) {
        const p = P.pts[i];
        const sx = p.x - cx - Math.sin(p.a) * off;
        const sy = p.y - cy + Math.cos(p.a) * off;
        const vis = sx > -20 && sx < W + 20 && sy > -20 && sy < H + 20;
        if (vis && !drawing) g.moveTo(sx, sy);
        else if (vis) g.lineTo(sx, sy);
        drawing = vis;
      }
      g.strokePath();
    }
    for (let i = 0; i < ptsN; i += 4) {
      const p = P.pts[i];
      const sx = p.x - cx;
      const sy = p.y - cy;
      if (sx < -6 || sx > W + 6 || sy < -6 || sy > H + 6) continue;
      g.fillStyle(0x8c8c98, 1).fillRect(sx, sy + 2, 1, 2);
    }
    // El sacacorchos: dos rieles que se enroscan.
    const cork = P.zones.find((z) => z.kind === 'corkscrew');
    if (cork) {
      for (let s = cork.from; s < cork.to; s += 2) {
        const p = P.at(s);
        const ph = ((s - cork.from) / (cork.to - cork.from)) * Math.PI * 2;
        const sx = p.x - cx;
        if (sx < -4 || sx > W + 4) continue;
        const off = Math.cos(ph) * 7;
        g.fillStyle(Math.sin(ph) > 0 ? 0xf06070 : 0x8c1c28, 1).fillRect(sx, p.y - cy - 4 + off, 2, 2).fillRect(sx, p.y - cy - 4 - off, 2, 2);
      }
    }
    // Cafetos del tramo rasante (detrás).
    const low = P.zones.find((z) => z.kind === 'low');
    if (low) this.drawBushes(g, low, false);
    // El tren.
    const tunnel = P.zones.find((z) => z.kind === 'tunnel');
    const inTunnel = !!tunnel && this.cs > tunnel.from + 10 && this.cs < tunnel.to - 4;
    if (!inTunnel) this.drawTrain(g);
    // Lo de adelante: la roca del túnel, cafetos y la gente de la estación.
    if (!yippe) this.drawVolcano(g, true);
    if (low) this.drawBushes(g, low, true);
    this.drawStations(g, true);
    if (inTunnel) {
      // Adentro del cráter: oscuro, la lava abajo y unos ojitos que miran.
      g.fillStyle(0x0c0806, 0.9).fillRect(0, 0, W, H);
      const lava = 0.5 + Math.sin(this.elapsed * 6) * 0.2;
      g.fillStyle(0xe8501c, lava).fillRect(0, H - 22, W, 22);
      g.fillStyle(0xf8b030, lava).fillRect(0, H - 22, W, 3);
      for (let i = 0; i < 5; i++) {
        const ex = (i * 71 + this.elapsed * 8) % W;
        const ey = 30 + ((i * 37) % 80);
        if (Math.sin(this.elapsed * 3 + i) > -0.4) g.fillStyle(0xf8e070, 0.9).fillRect(ex, ey, 2, 1).fillRect(ex + 4, ey, 2, 1);
      }
      const p = P.at(this.cs);
      g.fillStyle(0xfff4c8, 0.16).fillTriangle(p.x - cx + 12, p.y - cy - 10, p.x - cx + 120, p.y - cy - 50, p.x - cx + 120, p.y - cy + 20);
      this.drawTrain(g);
    }
    // Velocidad: rayas de viento.
    if (this.cv > 190 && !inTunnel) {
      const n = Math.floor((this.cv - 190) / 20) + 2;
      for (let i = 0; i < n; i++) {
        const y = (i * 53 + this.elapsed * 400) % H;
        const x = (i * 97 + this.elapsed * 900) % (W + 60) - 30;
        g.fillStyle(0xffffff, 0.35).fillRect(W - x, y, 18 + (i % 3) * 8, 1);
      }
    }
  }

  /** El volcán (atrás) o la roca del túnel (adelante). */
  private drawVolcano(g: Phaser.GameObjects.Graphics, front: boolean): void {
    const P = this.path;
    const cx = this.camX;
    const cy = this.camY;
    const l2 = P.at(P.mark('lift2'));
    const cr = P.at(P.mark('crater'));
    const out = P.at(P.mark('tunnelOut'));
    if (out.x + 120 - cx < 0 || l2.x - 80 - cx > BASE_WIDTH) return;
    const G = P.ground - cy;
    if (!front) {
      const lx = l2.x - 40 - cx;
      const rx = out.x + 90 - cx;
      const top = cr.y - cy + 34;
      g.fillStyle(0x6a4a3a, 1).fillTriangle(lx, G, cr.x - 50 - cx, top, cr.x - cx, G);
      g.fillTriangle(cr.x - 50 - cx, top, cr.x + 80 - cx, top + 4, cr.x - cx, G);
      g.fillTriangle(cr.x + 80 - cx, top + 4, rx, G, cr.x - cx, G);
      // Vetas de roca, siempre adentro del cono.
      const L = cr.x - 50 - cx;
      const R = cr.x + 80 - cx;
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        const y = top + (G - top) * t;
        const xl = L + (lx - L) * t + 6;
        const xr = R + (rx - R) * t - 6;
        if (xr > xl) g.fillStyle(0x5a3c2c, 1).fillRect(xl, y, xr - xl, 2);
      }
      // La lava del cráter y el humito.
      const glow = 0.6 + Math.sin(this.elapsed * 4) * 0.2;
      g.fillStyle(0xe8501c, glow).fillEllipse(cr.x + 15 - cx, top + 2, 120, 8);
      g.fillStyle(0xf8b030, glow).fillEllipse(cr.x + 15 - cx, top + 1, 70, 4);
      for (let i = 0; i < 4; i++) {
        const t = (this.elapsed * 0.3 + i / 4) % 1;
        g.fillStyle(0xd8d0c8, 0.5 * (1 - t)).fillCircle(cr.x + 10 + i * 14 - cx + t * 20, top - t * 70, 6 + t * 10);
      }
      return;
    }
    const tunnel = P.zones.find((z) => z.kind === 'tunnel');
    if (!tunnel) return;
    const a = P.at(tunnel.from);
    const b = P.at(tunnel.to);
    const x0 = a.x - cx - 6;
    const x1 = b.x - cx + 6;
    const top = Math.min(a.y, b.y) - cy - 26;
    g.fillStyle(0x5a3c2c, 1).fillRect(x0, top, x1 - x0, G - top + 2);
    for (let x = x0; x < x1; x += 14) g.fillStyle(0x6a4a3a, 1).fillTriangle(x, top + 1, x + 7, top - 6 - ((x * 7) % 5), x + 14, top + 1);
    for (const [px, py] of [[a.x, a.y], [b.x, b.y]] as const) {
      g.fillStyle(0x1c120c, 1).fillEllipse(px - cx, py - cy - 4, 18, 30);
      g.fillStyle(0x3a2a1c, 1).fillRect(px - cx - 10, py - cy - 22, 20, 3);
    }
  }

  private drawBushes(g: Phaser.GameObjects.Graphics, z: ZoneSpan, front: boolean): void {
    for (let s = z.from - 20; s < z.to + 20; s += 22) {
      const p = this.path.at(s);
      const sx = p.x - this.camX + (front ? 8 : -6);
      if (sx < -14 || sx > BASE_WIDTH + 14) continue;
      const gy = this.path.ground - this.camY;
      const h = front ? 12 + ((s * 7) % 6) : 20 + ((s * 3) % 8);
      g.fillStyle(front ? 0x2c6c2c : 0x3c7c34, 1).fillEllipse(sx, gy - h / 2 + 2, 16, h);
      for (let k = 0; k < 3; k++) g.fillStyle(0xd8303c, 1).fillRect(sx - 4 + k * 4, gy - h / 2 - 2 + k * 3, 2, 2);
    }
  }

  /** La estación del principio y la del final (el Krater da la vuelta y vuelve a la misma). */
  private drawStations(g: Phaser.GameObjects.Graphics, front: boolean): void {
    const P = this.path;
    const yippe = this.mode === 'yippe';
    for (const z of P.zones.filter((zz) => zz.kind === 'station')) {
      const a = P.at(z.from);
      const b = P.at(z.to);
      const x0 = a.x - this.camX;
      const x1 = b.x - this.camX;
      if (x1 < -20 || x0 > BASE_WIDTH + 20) continue;
      const y = a.y - this.camY;
      if (!front) {
        g.fillStyle(0x8c6c4c, 1).fillRect(x0, y + 4, x1 - x0, P.ground - a.y - 4);
        g.fillStyle(0x3a2a1c, 1).fillRect(x0 + 6, y - 36, 3, 40).fillRect(x1 - 9, y - 36, 3, 40);
        g.fillStyle(yippe ? 0x2c9cd8 : 0xc8303c, 1).fillRect(x0 - 4, y - 42, x1 - x0 + 8, 8);
        for (let x = x0 - 4; x < x1 + 4; x += 12) g.fillStyle(0xf4f0e6, 1).fillRect(x, y - 42, 6, 8);
        continue;
      }
      // La gente en la fila / mirando, al frente de la estación.
      for (let i = 0; i < 6; i++) {
        const px = x0 + 14 + i * ((x1 - x0 - 20) / 6);
        const bob = Math.sin(this.elapsed * 5 + i) > 0.6 ? 1 : 0;
        g.fillStyle([0xe868a8, 0x2c9c58, 0xf8dc68, 0x5a90e8, 0xe8742c, 0x8c5cc8][i], 1).fillRect(px - 3, y + 10 - bob, 6, 8);
        g.fillStyle(SKIN, 1).fillRect(px - 2, y + 5 - bob, 4, 4);
        if (bob) g.fillStyle(SKIN, 1).fillRect(px + 3, y + 2, 1, 4);
      }
    }
  }

  private drawTrain(g: Phaser.GameObjects.Graphics): void {
    const P = this.path;
    const yippe = this.mode === 'yippe';
    const cork = P.zones.find((z) => z.kind === 'corkscrew');
    const helix = P.zones.find((z) => z.kind === 'helix');
    const riders: Array<[[number, boolean], [number, boolean]]> = yippe
      ? [[[0x3a2418, false], [0x1c1418, false]], [[0xc89050, false], [0x6a3c1c, true]], [[0x2a1c14, true], [0xd8b070, false]]]
      : [[[0x3a2418, false], [FLOR_HAIR, true]], [[0x1c1418, false], [0x8c5c34, true]], [[0x6a6a6a, false], [0x2a1c14, true]]];
    const play = this.phase === 'play' && this.dispatchMs >= DISPATCH_MS;
    for (let i = riders.length - 1; i >= 0; i--) {
      const s = Math.max(0, this.cs - i * 17);
      const p = P.at(s);
      const sx = p.x - this.camX;
      const sy = p.y - this.camY;
      if (sx < -30 || sx > BASE_WIDTH + 30) continue;
      let sy2 = 1;
      let sx2 = 1;
      if (cork && s > cork.from && s < cork.to) sy2 = Math.cos(((s - cork.from) / (cork.to - cork.from)) * Math.PI * 2);
      if (helix && s > helix.from && s < helix.to) sx2 = 0.8 + 0.2 * Math.cos(((s - helix.from) / 64) * Math.PI);
      const air = P.curvature(s) < -0.01 && this.cv > 120 ? -2 : 0;
      g.save();
      g.translateCanvas(sx, sy);
      g.rotateCanvas(p.a);
      g.scaleCanvas(sx2, sy2 >= 0 ? Math.max(0.2, sy2) : Math.min(-0.2, sy2));
      // Riders.
      const [[h1, l1], [h2, l2]] = riders[i];
      const front = i === 0;
      const handsMe = front && play && Controls.isHeld('interact');
      const duck = front && play && Controls.isHeld('down');
      const scream = front && this.elapsed - this.lastScream < 0.6;
      const yMe = -15 + (duck ? 4 : 0) + air;
      this.head(g, 5, yMe, h1, l1);
      this.head(g, -6, -15 + air, h2, l2);
      if (front && scream) g.fillStyle(0x7a2a2a, 1).fillRect(7, yMe + 1, 2, 3);
      if (handsMe) g.fillStyle(SKIN, 1).fillRect(2, yMe - 15, 2, 10).fillRect(8, yMe - 15, 2, 10);
      // Los demás: Flor a veces arriba, Juanpa siempre, Renzo agarrado.
      const othersUp = !yippe && (i === 1 || (i === 0 && Math.sin(this.elapsed * 1.3) > 0.3) || (i === 2 && this.cv > 200));
      if (othersUp) g.fillStyle(SKIN, 1).fillRect(-9, -30 + air, 2, 10).fillRect(-3, -30 + air, 2, 10);
      if (yippe && i === 0 && this.cv > 80) g.fillStyle(0x7a2a2a, 1).fillRect(-5, -14, 3, 3);
      // El carro.
      const body = yippe ? (i === 0 ? 0x48b860 : 0x2c9cd8) : 0xc8303c;
      g.fillStyle(0x2a2433, 1).fillRect(-9, -11, 19, 10);
      g.fillStyle(body, 1).fillRect(-8, -10, 17, 8);
      g.fillStyle(0xf8e070, 1).fillRect(-8, -10, 17, 2);
      g.fillStyle(0x3a3a48, 1).fillRect(-7, -2, 3, 2).fillRect(4, -2, 3, 2);
      if (i === 0 && yippe) {
        // El Yippe tiene cara: un gusanito sonriente.
        g.fillStyle(0x48b860, 1).fillCircle(11, -9, 5);
        g.fillStyle(0x14121a, 1).fillRect(12, -11, 2, 2);
        g.fillStyle(0xe8303c, 1).fillRect(11, -7, 3, 1);
      }
      g.restore();
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
    if (this.mode === 'krater' || this.mode === 'yippe') this.drawCoaster(g);
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
      this.mode === 'krater' || this.mode === 'yippe'
        ? `Valentía: ${this.score}/${this.prompts.length} · ${this.kmh} km/h`
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
