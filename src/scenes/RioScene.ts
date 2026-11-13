import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import { bust } from '../art/vinetas_m5';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import { playerLook } from '../systems/PlayerLook';
import { MiniScene } from './MiniScene';

/**
 * Misión 10: los juegos del domingo en el río Pance con Danilo. Solo usan las flechas (o WASD) y E, así que se
 * juegan igual con los controles táctiles.
 *  - `parquear`: el carro de Danilo entra de reversa al parqueadero de tierra. A/D le dicen para dónde girar y E
 *    grita «¡pare!». Hay que dejarlo derecho, adentro del puesto y sin raspar los carros de al lado.
 *  - `chorro`: la «ducha» bajo el chorro helado. Mantén E para quedarte debajo: la ducha avanza, pero el frío
 *    sube; suelta para respirar. Si el frío llega al tope, gritas y sales corriendo.
 *  - `corriente`: río abajo en un neumático, del Puente 3 al 4. A/D para esquivar piedras y ramas; W frena un poco
 *    y S rema más rápido. Los rápidos te empujan.
 *  - `puente`: cruzar hasta la mitad del puente colgante con Danilo saltando atrás. W avanza, A/D compensan el
 *    balanceo. Si te vas mucho para un lado, te agarras del cable.
 *  - `fotos`: el celular en la mitad del puente. Las flechas mueven el visor y E dispara: Danilo en el aire, el río,
 *    los Farallones (o un barranquero, si pasa). Al final, la selfie: dispara cuando los dos estén sonriendo.
 *  - `historia`: subir una historia a Fotogram. Elige foto, sticker y texto (A/D y E) y publica.
 * Esc salta el juego.
 */

export type RioMode = 'parquear' | 'chorro' | 'corriente' | 'puente' | 'fotos' | 'historia';

export interface RioResult {
  mode: RioMode;
  score: number;
  good: boolean;
  perfect: boolean;
  skipped: boolean;
  /** Fotos: los nombres de las fotos buenas. */
  photos?: string[];
  /** Fotos: le sacaste foto al barranquero. */
  barranquero?: boolean;
  /** Historia: la foto, el sticker y el texto que elegiste. */
  story?: { photo: string; sticker: string; text: string };
}

export interface RioSceneData {
  mode: RioMode;
  /** Historia: las fotos de la galería (las del puente). */
  photos?: string[];
  done: (r: RioResult) => void;
}

const INTROS: Record<RioMode, { title: string; text: string; hint: string }> = {
  parquear: {
    title: 'El parqueadero de tierra',
    text: 'Danilo: «Guiáme, parce, que de reversa soy un desastre.»\nA/D: «¡gire pa\'llá!» · E: «¡PARE!»\nQue quede derecho, adentro del puesto y sin raspar a nadie.',
    hint: 'A/D: girar · E: ¡pare! · Esc: saltar',
  },
  chorro: {
    title: 'El chorro del Pance',
    text: 'Danilo: «El que no aguanta, paga el sancocho.»\nMantén E para quedarte debajo del chorro: la ducha avanza pero el frío sube.\nSuelta para respirar. Si el frío llega al tope... gritas.',
    hint: 'Mantén E: debajo del chorro · Esc: saltar',
  },
  corriente: {
    title: 'Río abajo, en neumático',
    text: 'Del Puente 3 al Puente 4, dejándote llevar.\nA/D: esquivar piedras y ramas · W: frenar · S: remar.\nLos rápidos te empujan. Danilo va al lado, cantando.',
    hint: 'A/D: esquivar · W: frenar · S: remar · Esc: saltar',
  },
  puente: {
    title: 'El puente colgante',
    text: 'Danilo: «Caminá por el medio y no mirés pa\'bajo.»\nW: avanzar · A/D: compensar el balanceo.\n(Danilo va a saltar. Obvio que va a saltar.)',
    hint: 'W: avanzar · A/D: equilibrio · Esc: saltar',
  },
  fotos: {
    title: 'Fotos desde el puente',
    text: 'Tres fotos del paisaje y una selfie.\nFlechas: mover el visor · E: disparar.\nDanilo en el aire, el río, los Farallones... y si pasa un barranquero, ¡no lo pierdas!',
    hint: 'Flechas: visor · E: foto · Esc: saltar',
  },
  historia: {
    title: 'Fotogram · Tu historia',
    text: 'Elige la foto, un sticker y un texto.\nA/D: cambiar · E: elegir.\nY después... publicar.',
    hint: 'A/D: cambiar · E: elegir · Esc: saltar',
  },
};

const STICKERS = ['Río Pance', '31 °C', 'Salsa de domingo', 'Sin sticker'];
const TEXTS = ['domingo de río', 'sin dormir y feliz', 'agua fría > guayabo', 'Sin texto'];

function look(id: string): HumanLook {
  return characterLook(id) as HumanLook;
}

function hex(c: string): number {
  return Phaser.Display.Color.HexStringToColor(c).color;
}

interface Obstacle {
  x: number;
  y: number;
  r: number;
  kind: 'piedra' | 'rama' | 'rapido';
  hit: boolean;
  /** Ya golpeó a Danilo. */
  hitDan: boolean;
  /** Danilo la ve venir (y la esquiva); si no, se la come. */
  danSees: boolean;
}

export class RioScene extends MiniScene<RioResult> {
  private mode: RioMode = 'parquear';
  private phase: 'intro' | 'play' | 'end' = 'intro';
  private score = 0;
  private good = false;
  private perfect = false;
  private skipped = false;
  private g!: Phaser.GameObjects.Graphics;
  private faces!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private bigText!: Phaser.GameObjects.Text;
  private extraTexts: Phaser.GameObjects.Text[] = [];
  private t = 0;
  private me!: HumanLook;
  private danilo!: HumanLook;

  // Parquear
  private car = { x: 160, y: 168, ang: 0, v: 0, stopped: false };
  private steer = 0;
  private wobble = 0;
  private shoutMs = 0;

  // Chorro
  private under = false;
  private shower = 0;
  private cold = 0;
  private screams = 0;
  private gust = 0;
  private timeLeft = 35;

  // Corriente
  private tube = { x: 160, vx: 0 };
  private dist = 0;
  private obstacles: Obstacle[] = [];
  private spawnMs = 0;
  private hits = 0;
  private hitFlash = 0;
  /** Cuánto ha bajado el río en píxeles: mueve las orillas, las ondas y los obstáculos al mismo ritmo. */
  private scrollY = 0;
  private dan = { x: 120, vx: 0, hurt: 0, hits: 0 };

  // Puente
  private walk = 0;
  private lean = 0;
  private leanV = 0;
  private grabs = 0;
  private grabMs = 0;
  private jumpMs = 0;

  // Fotos
  private view = { x: 200, y: 60 };
  private shots: Array<{ name: string; ok: boolean }> = [];
  private taken = new Set<string>();
  private bird = { x: -40, y: 40, on: false, next: 4 };
  private flashMs = 0;
  private selfie = false;
  private faceT = 0;
  private gotBird = false;

  // Historia
  private photos: string[] = [];
  private step = 0;
  private pick = [0, 0, 0];
  private views = 0;
  private postMs = 0;

  constructor() {
    super('Rio');
  }

  init(data: RioSceneData): void {
    this.initMini(data.done);
    this.mode = data.mode;
    this.phase = 'intro';
    this.score = 0;
    this.good = false;
    this.perfect = false;
    this.skipped = false;
    this.t = 0;
    this.extraTexts = [];
    this.car = { x: 160 + (Math.random() < 0.5 ? -26 : 26), y: 176, ang: 0, v: 0, stopped: false };
    this.steer = 0;
    this.wobble = 0;
    this.shoutMs = 0;
    this.under = false;
    this.shower = 0;
    this.cold = 0;
    this.screams = 0;
    this.gust = 0;
    this.timeLeft = 35;
    this.tube = { x: 160, vx: 0 };
    this.dist = 0;
    this.obstacles = [];
    this.spawnMs = 0;
    this.hits = 0;
    this.hitFlash = 0;
    this.scrollY = 0;
    this.dan = { x: 120, vx: 0, hurt: 0, hits: 0 };
    this.walk = 0;
    this.lean = 0;
    this.leanV = 0;
    this.grabs = 0;
    this.grabMs = 0;
    this.jumpMs = 1800;
    this.view = { x: 200, y: 60 };
    this.shots = [];
    this.taken = new Set();
    this.bird = { x: -40, y: 40, on: false, next: 3 + Math.random() * 4 };
    this.flashMs = 0;
    this.selfie = false;
    this.faceT = 0;
    this.gotBird = false;
    this.photos = data.photos && data.photos.length > 0 ? data.photos : ['El río verde'];
    this.step = 0;
    this.pick = [0, 0, 0];
    this.views = 0;
    this.postMs = 0;
  }

  create(): void {
    this.me = playerLook();
    this.danilo = look(this.mode === 'parquear' || this.mode === 'historia' ? 'danilo' : 'danilo_bano');
    this.g = this.add.graphics();
    this.faces = this.add.graphics().setDepth(5);
    const bg = { parquear: '#a07c54', chorro: '#2a7c94', corriente: '#2a7c94', puente: '#2c6a34', fotos: '#7cb8e8', historia: '#1c1c24' }[this.mode];
    this.createUi(bg);
    this.infoText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', fontStyle: '600', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);
    this.bigText = this.addText(BASE_WIDTH / 2, 28, '', { fontSize: '10px', fontStyle: '700', color: '#f8e070', stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(52);
    const intro = INTROS[this.mode];
    this.titleText.setText(intro.title);
    this.hintText.setText(intro.hint);
    playMusic(this.mode === 'parquear' ? 'carro_danilo' : this.mode === 'historia' ? 'depa' : 'rio');
    this.banner(`${intro.text}\n(E para empezar)`);
    this.draw();
  }

  override update(_t: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    const dt = Math.min(delta, 40) / 1000;
    this.t += dt;
    if (this.phase === 'intro') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        this.phase = 'play';
      }
    } else if (this.phase === 'play') {
      if (Controls.consume('menu')) {
        this.skipped = true;
        this.good = true;
        this.endGame('Te saltaste esta parte. Danilo hace como que no vio nada.');
      } else if (this.mode === 'parquear') this.playParquear(dt, delta);
      else if (this.mode === 'chorro') this.playChorro(dt, delta);
      else if (this.mode === 'corriente') this.playCorriente(dt, delta);
      else if (this.mode === 'puente') this.playPuente(dt, delta);
      else if (this.mode === 'fotos') this.playFotos(dt, delta);
      else this.playHistoria(delta);
    } else if (this.phase === 'end') {
      if (Controls.consume('interact')) this.finish(this.result());
    }
    this.draw();
  }

  private result(): RioResult {
    const r: RioResult = { mode: this.mode, score: this.score, good: this.good, perfect: this.perfect, skipped: this.skipped };
    if (this.mode === 'fotos') {
      r.photos = this.shots.filter((s) => s.ok).map((s) => s.name);
      if (r.photos.length === 0) r.photos = ['Una foto movida del río'];
      r.barranquero = this.gotBird;
    }
    if (this.mode === 'historia') r.story = { photo: this.photos[this.pick[0]], sticker: STICKERS[this.pick[1]], text: TEXTS[this.pick[2]] };
    return r;
  }

  private endGame(verdict: string): void {
    this.phase = 'end';
    this.bigText.setText('');
    playSfx(this.good ? 'item' : 'cancel');
    this.banner(`${verdict}\n(E para seguir)`);
  }

  // -------------------------------------------------------------------------
  // Parquear
  // -------------------------------------------------------------------------

  /** El puesto libre: entre los dos carros de arriba. */
  private readonly slot = { x: 160, y: 40, w: 30, h: 44 };

  private playParquear(dt: number, delta: number): void {
    const c = this.car;
    if (c.stopped) return;
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    // Danilo gira lo que le dices... y un poquito más (de reversa es un desastre).
    this.wobble += dt;
    this.steer = Phaser.Math.Linear(this.steer, input * 0.9 + Math.sin(this.wobble * 1.7) * 0.35, Math.min(1, dt * 4));
    c.v = 26 + Math.min(10, this.t * 2);
    c.ang = Phaser.Math.Clamp(c.ang + this.steer * dt * 0.9, -0.5, 0.5);
    c.x += Math.sin(c.ang) * c.v * dt;
    c.y -= Math.cos(c.ang) * c.v * dt;
    this.shoutMs -= delta;
    if (this.shoutMs <= 0) {
      this.shoutMs = 1500;
      this.say(['Cuidador: «¡Dele, dele, dele!»', 'Cuidador: «¡Venga, venga, venga!»', 'Danilo: «¿Voy bien? ¿Voy bien?»', 'Cuidador: «¡Todo, todo, todo!»'][Math.floor(this.t) % 4], 250, 150, 1200);
    }
    // ¿Raspó a los de al lado?
    const half = 11;
    const rear = c.y - 22;
    const sideCars = [this.slot.x - 34, this.slot.x + 34];
    const scraped = rear < this.slot.y + this.slot.h && sideCars.some((sx) => Math.abs(c.x - sx) < half + 13);
    if (scraped || rear < this.slot.y - 4) {
      c.stopped = true;
      playSfx('golpe');
      this.cameras.main.shake(250, 0.01);
      this.good = false;
      this.endGame(scraped ? '¡RAAASSS! Raspaste el carro de al lado. Danilo se agarra la cabeza.' : '¡PUM! Contra el muro. Danilo: «Parce... eso era un muro.»');
      return;
    }
    if (Controls.consume('interact')) {
      c.stopped = true;
      playSfx('bus-brake');
      const depth = rear - this.slot.y;
      const offset = Math.abs(c.x - this.slot.x);
      const angle = Math.abs(c.ang);
      const inside = depth >= -2 && depth <= 16;
      this.score = inside ? Math.max(0, 100 - Math.round(offset * 6 + angle * 120 + Math.abs(depth - 6) * 2)) : 0;
      this.good = inside && offset < 7 && angle < 0.2;
      this.perfect = this.good && offset < 3 && angle < 0.08;
      const verdict = !inside
        ? depth > 16
          ? 'Quedó a medio puesto, con la cola en la vía. Danilo: «Bueno... ahí lo acomodo yo.»'
          : 'Quedó encima de la raya. Danilo: «Así está bien. Así está... más o menos.»'
        : this.perfect
          ? '¡Perfecto! Derechito, al centímetro. El cuidador te aplaude con el trapo rojo.'
          : this.good
            ? '¡Quedó bien! Danilo: «¿Ves? Yo sabía que vos servías para algo.»'
            : 'Quedó adentro... pero torcido. Danilo: «Lo importante es que entró.»';
      this.endGame(verdict);
    }
  }

  private drawParquear(): void {
    const g = this.g;
    g.fillStyle(hex('#a07c54'), 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let i = 0; i < 60; i++) g.fillStyle(hex(i % 2 ? '#8c6a44' : '#b89068'), 1).fillRect((i * 53) % BASE_WIDTH, (i * 37) % BASE_HEIGHT, 2, 2);
    // Guaduas al fondo y el monte.
    g.fillStyle(hex('#2c6a34'), 1).fillRect(0, 0, BASE_WIDTH, 22);
    for (let x = 4; x < BASE_WIDTH; x += 9) g.fillStyle(hex('#7cbc4c'), 1).fillRect(x, 0, 2, 22);
    // Puestos y carros de los lados.
    const s = this.slot;
    g.lineStyle(1, 0xf4f0e6, 0.8);
    for (const x of [s.x - 51, s.x - 17, s.x + 17, s.x + 51]) g.lineBetween(x, s.y - 4, x, s.y + s.h);
    g.fillStyle(0x58f0a0, 0.18).fillRect(s.x - s.w / 2, s.y - 2, s.w, 18);
    this.topCar(s.x - 34, s.y + 22, 0, '#c8303c');
    this.topCar(s.x + 34, s.y + 22, 0, '#e8e8e0');
    this.topCar(s.x - 68, s.y + 22, 0, '#2c64c0');
    this.topCar(s.x + 68, s.y + 22, 0, '#e8c030');
    // El carro de Danilo.
    this.topCar(this.car.x, this.car.y, this.car.ang, '#8c9098', true);
    // El cuidador con el trapo rojo.
    const cx = 268;
    const cy = 120;
    g.fillStyle(hex('#1c1c24'), 1).fillRect(cx - 4, cy - 2, 8, 14);
    g.fillStyle(hex('#e8c030'), 1).fillRect(cx - 3, cy - 1, 6, 8);
    g.fillStyle(hex('#8a5a3a'), 1).fillCircle(cx, cy - 6, 4);
    const wave = Math.sin(this.t * 10) * 6;
    g.fillStyle(hex('#c8303c'), 1).fillRect(cx + 4, cy - 12 + wave, 8, 6);
    this.infoText.setText(this.phase === 'play' && !this.car.stopped ? 'E: ¡PARE!' : '');
  }

  /** Carro visto desde arriba, centrado en (x, y), girado `ang` (la trompa hacia abajo). */
  private topCar(x: number, y: number, ang: number, color: string, danilo = false): void {
    const g = this.g;
    const pts = (dx: number, dy: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x + dx * Math.cos(ang) - dy * Math.sin(ang), y + dx * Math.sin(ang) + dy * Math.cos(ang));
    const quad = (x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void => {
      const p = [pts(x0, y0), pts(x1, y0), pts(x1, y1), pts(x0, y1)];
      g.fillStyle(c, a).fillPoints(p, true);
    };
    quad(-12, -23, 12, 23, 0x1c1c24);
    quad(-11, -22, 11, 22, hex(color));
    quad(-9, -12, 9, -4, 0x4a6a84);
    quad(-9, 6, 9, 12, 0x4a6a84);
    quad(-11, -22, -7, -20, 0xe84040);
    quad(7, -22, 11, -20, 0xe84040);
    if (danilo) quad(-4, -16, 4, -14, 0xe8c030);
  }

  // -------------------------------------------------------------------------
  // Chorro
  // -------------------------------------------------------------------------

  private playChorro(dt: number, delta: number): void {
    this.timeLeft -= dt;
    this.under = Controls.isHeld('interact');
    this.gust -= delta;
    if (this.gust < -4000 && Math.random() < dt * 0.4) {
      this.gust = 1800;
      this.say('Danilo: «¡Uy, viene más fuerte!»', 160, 40, 1300);
    }
    const strong = this.gust > 0 ? 1.7 : 1;
    if (this.under) {
      this.shower = Math.min(100, this.shower + dt * 7.5);
      this.cold = Math.min(100, this.cold + dt * 17 * strong);
      if (Math.random() < dt * 6) playSfx('splash');
    } else {
      this.cold = Math.max(0, this.cold - dt * 24);
    }
    if (this.cold >= 100) {
      this.screams++;
      this.cold = 55;
      playSfx('chapuzon');
      this.cameras.main.shake(300, 0.012);
      this.say(['¡AAAAAHHH!', '¡AY, AY, AY, QUÉ FRÍO!', '¡MAMÁÁÁ!'][(this.screams - 1) % 3], 160, 70, 1200);
      this.float('¡Gritaste!', '#ff9c9c', 160, 90);
    }
    if (Math.floor(this.timeLeft) % 7 === 0 && Math.floor(this.timeLeft) !== Math.floor(this.timeLeft + dt) && this.under) {
      this.say(`Danilo: «¡${Math.round(this.shower / 10)}! ¡Aguantá!»`, 250, 50, 900);
    }
    if (this.shower >= 100 || this.timeLeft <= 0) {
      this.score = Math.round(this.shower);
      this.good = this.shower >= 100 && this.screams <= 1;
      this.perfect = this.shower >= 100 && this.screams === 0;
      this.endGame(
        this.perfect
          ? '¡Ni un grito! Una señora te aplaude desde la orilla. Danilo: «Oso polar del Pance.»'
          : this.good
            ? 'Aguantaste (con un gritico). Despierto. Completamente despierto.'
            : this.shower >= 100
              ? 'Te duchaste... a punta de gritos. Medio río te escuchó.'
              : 'Se acabó el tiempo. Danilo: «El sancocho lo pagás vos, chileno.»',
      );
    }
  }

  private drawChorro(): void {
    const g = this.g;
    // Bosque, la laja y el chorro.
    g.fillStyle(hex('#2c6a34'), 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    g.fillStyle(hex('#3c8040'), 1).fillRect(0, 0, 90, 120).fillRect(230, 0, 90, 120);
    for (let x = 6; x < 90; x += 11) g.fillStyle(hex('#7cbc4c'), 1).fillRect(x, 0, 3, 120);
    g.fillStyle(hex('#6c665e'), 1).fillRect(80, 14, 160, 30);
    g.fillStyle(hex('#9c968c'), 1).fillRect(80, 14, 160, 22);
    g.fillStyle(hex('#c8c2b4'), 1).fillRect(84, 14, 150, 6);
    const flow = (this.t * 140) % 12;
    g.fillStyle(hex('#e8f8f4'), 0.95).fillRect(146, 36, 28, 110);
    for (let y = 36 + flow; y < 146; y += 12) g.fillStyle(hex('#b8e4e4'), 1).fillRect(150, y, 3, 6).fillRect(165, y + 5, 3, 6);
    // El pozo.
    g.fillStyle(hex('#3c9cac'), 1).fillRect(0, 140, BASE_WIDTH, 40);
    g.fillStyle(hex('#e8f8f4'), 0.8).fillEllipse(160, 146, 70, 10);
    // Tú: debajo del chorro o al lado, temblando.
    const px = this.under ? 160 : 112;
    const shiver = this.cold > 60 ? Math.sin(this.t * 60) * (this.cold - 60) / 25 : 0;
    this.faces.clear();
    bust(this.faces, this.me, px + shiver, 112, 3, this.under ? { eyes: 'closed', mouth: this.cold > 70 ? 'o' : 'teeth' } : { mouth: this.cold > 50 ? 'o' : 'smile', eyes: this.cold > 50 ? 'squint' : 'open' });
    if (this.under) this.faces.fillStyle(hex('#e8f8f4'), 0.7).fillRect(146, 84, 28, 50);
    // Danilo en la orilla, con los brazos cruzados.
    bust(this.faces, this.danilo, 262, 118, 2.6, { mouth: this.screams > 0 ? 'grin' : 'smile', eyes: this.screams > 0 ? 'squint' : 'open' });
    // Barras: ducha y frío.
    this.bar(10, 22, 'Ducha', this.shower, '#58d4d0');
    this.bar(10, 36, 'Frío', this.cold, this.cold > 75 ? '#e85a64' : '#9cc8e8');
    this.infoText.setText(`${Math.max(0, Math.ceil(this.timeLeft))} s · gritos: ${this.screams}`);
  }

  private bar(x: number, y: number, name: string, v: number, color: string): void {
    const g = this.g;
    g.fillStyle(0x0c1020, 0.75).fillRect(x, y, 84, 10);
    g.fillStyle(hex(color), 1).fillRect(x + 30, y + 2, (v / 100) * 50, 6);
    g.lineStyle(1, 0xfbf6ee, 0.6).strokeRect(x + 30, y + 2, 50, 6);
    if (!this.extraTexts.some((t) => t.name === name)) {
      const t = this.addText(x + 3, y + 1, name, { fontSize: '7px', color: '#fbf6ee' }).setDepth(41);
      t.name = name;
      this.extraTexts.push(t);
    }
  }

  // -------------------------------------------------------------------------
  // Corriente
  // -------------------------------------------------------------------------

  private bankAt(y: number): [number, number] {
    // Coordenada del río (no de la pantalla): al bajar, todo lo dibujado baja exactamente `scroll` píxeles.
    const k = (this.scrollY - y) / 60;
    const mid = 160 + Math.sin(k) * 38 + Math.sin(k * 0.37) * 18;
    const w = 92 + Math.sin(k * 0.6) * 18;
    return [mid - w, mid + w];
  }

  private playCorriente(dt: number, delta: number): void {
    let speed = 34;
    if (Controls.isHeld('up')) speed = 22;
    if (Controls.isHeld('down')) speed = 48;
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    this.tube.vx += input * 260 * dt;
    this.tube.vx *= 1 - 3 * dt;
    // La corriente te lleva al centro del río (y los rápidos te empujan).
    const [l, r] = this.bankAt(140);
    const mid = (l + r) / 2;
    this.tube.vx += (mid - this.tube.x) * 0.6 * dt;
    this.tube.x += this.tube.vx * dt;
    if (this.tube.x < l + 10 || this.tube.x > r - 10) {
      this.tube.x = Phaser.Math.Clamp(this.tube.x, l + 10, r - 10);
      this.tube.vx *= -0.4;
    }
    const scroll = speed * dt * 2.2;
    this.scrollY += scroll;
    this.dist += scroll * 0.027;
    this.spawnMs -= delta;
    if (this.spawnMs <= 0 && this.dist < 97) {
      this.spawnMs = 520 + Math.random() * 520 - Math.min(300, this.dist * 3);
      const [bl, bR] = this.bankAt(-10);
      const kind: Obstacle['kind'] = Math.random() < 0.6 ? 'piedra' : Math.random() < 0.6 ? 'rama' : 'rapido';
      const x = bl + 16 + Math.random() * (bR - bl - 32);
      this.obstacles.push({ x, y: -12, r: kind === 'piedra' ? 8 + Math.random() * 5 : kind === 'rama' ? 18 : 16, kind, hit: false, hitDan: false, danSees: Math.random() < 0.6 });
    }
    for (const o of this.obstacles) {
      o.y += scroll;
      const dx = this.tube.x - o.x;
      const dy = 140 - o.y;
      if (o.kind === 'rapido') {
        if (Math.abs(dx) < o.r + 6 && Math.abs(dy) < 10) {
          this.tube.vx += (dx > 0 ? 1 : -1) * 150 * dt;
          this.dist += dt * 1.5;
          if (!o.hit) {
            o.hit = true;
            playSfx('splash');
            this.float('¡Rápido!', '#e8f8f4', o.x, o.y - 10);
          }
        }
      } else if (!o.hit) {
        const hitR = o.kind === 'rama' ? Math.abs(dx) < o.r + 8 && Math.abs(dy) < 8 : Math.hypot(dx, dy) < o.r + 12;
        if (hitR) {
          o.hit = true;
          this.hits++;
          this.hitFlash = 400;
          this.tube.vx = (dx >= 0 ? 1 : -1) * 90;
          playSfx('golpe');
          this.cameras.main.shake(180, 0.008);
          this.say(o.kind === 'rama' ? ['¡Una rama!', '¡Me enredé!', '¡Las hojas en la boca!'][this.hits % 3] : ['¡Ay, la piedra!', '¡Uy, el coxis!', '¡Piedra!'][this.hits % 3], this.tube.x, 120, 900);
        }
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.y < BASE_HEIGHT + 20);
    this.hitFlash -= delta;
    this.playDanilo(dt, delta);
    if (this.dan.hurt <= 0 && Math.random() < dt * 0.2)
      this.say(['Danilo: «¡Qué rico, parce!»', 'Danilo: «¡Por la derecha, por la derecha!»', 'Danilo (cantando): «¡Ahí va el río...!»', 'Danilo: «¡Mirá ese guadual!»'][Math.floor(Math.random() * 4)], this.dan.x, 96, 1200);
    if (this.dist >= 100) {
      this.score = Math.max(0, 10 - this.hits);
      this.good = this.hits <= 3;
      this.perfect = this.hits === 0;
      this.endGame(
        (this.perfect
          ? '¡Ni una piedra! Bajaste el Pance como un patico. Danilo: «¿Seguro que no naciste acá?»'
          : this.good
            ? `Llegaste al Puente 4 con ${this.hits} golpe${this.hits === 1 ? '' : 's'}. Nada que un sancocho no cure.`
            : `Llegaste... con ${this.hits} golpes, una rama en el pelo y el neumático al revés.`) +
          (this.dan.hits === 0
            ? ''
            : this.dan.hits === 1
              ? '\nDanilo se comió una piedra. Dice que fue a propósito.'
              : `\nDanilo se llevó ${this.dan.hits} golpes. «Nadie vio nada, ¿cierto?»`),
      );
    }
  }

  /** Danilo baja en su neumático, adelante: esquiva lo que ve venir y choca con lo que no (y le duele igual que a ti). */
  private playDanilo(dt: number, delta: number): void {
    const D_Y = 108;
    const d = this.dan;
    const [l, r] = this.bankAt(D_Y);
    // Se queda cerca del centro, un poco a la izquierda tuya.
    let steer = ((l + r) / 2 - 24 - d.x) * 0.8;
    for (const o of this.obstacles) {
      if (o.kind === 'rapido' || o.hitDan || !o.danSees) continue;
      const ahead = D_Y - o.y;
      if (ahead > 0 && ahead < 70 && Math.abs(o.x - d.x) < o.r + 18) steer += (d.x >= o.x ? 1 : -1) * 220;
    }
    if (d.hurt > 0) steer *= 0.3;
    d.vx += steer * dt;
    d.vx *= 1 - 3 * dt;
    d.x += d.vx * dt;
    if (d.x < l + 10 || d.x > r - 10) {
      d.x = Phaser.Math.Clamp(d.x, l + 10, r - 10);
      d.vx *= -0.4;
    }
    d.hurt -= delta;
    for (const o of this.obstacles) {
      const dx = d.x - o.x;
      const dy = D_Y - o.y;
      if (o.kind === 'rapido') {
        if (Math.abs(dx) < o.r + 6 && Math.abs(dy) < 10) d.vx += (dx > 0 ? 1 : -1) * 150 * dt;
        continue;
      }
      if (o.hitDan) continue;
      const hit = o.kind === 'rama' ? Math.abs(dx) < o.r + 8 && Math.abs(dy) < 8 : Math.hypot(dx, dy) < o.r + 12;
      if (!hit) continue;
      o.hitDan = true;
      d.hits++;
      d.hurt = 700;
      d.vx = (dx >= 0 ? 1 : -1) * 100;
      playSfx('golpe');
      this.float('¡Danilo!', '#ffc890', d.x, D_Y - 18);
      this.say(
        o.kind === 'rama'
          ? ['Danilo: «¡Ay, la rama! ¡Me entró al ojo!»', 'Danilo: «¡Parce, quedé enredado!»'][d.hits % 2]
          : ['Danilo: «¡AY! ¡La piedra, parce!»', 'Danilo: «¡Uy, mi coxis! ¡Mi coxis!»', 'Danilo: «Eso no lo vi. Eso no lo vi venir.»'][d.hits % 3],
        d.x,
        86,
        1300,
      );
    }
  }

  private drawCorriente(): void {
    const g = this.g;
    g.fillStyle(hex('#3c8040'), 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let y = 0; y < BASE_HEIGHT; y += 4) {
      const [l, r] = this.bankAt(y);
      g.fillStyle(hex('#b8ae9c'), 1).fillRect(l - 10, y, r - l + 20, 4);
      g.fillStyle(hex('#3c9cac'), 1).fillRect(l, y, r - l, 4);
      g.fillStyle(hex('#2a7c94'), 1).fillRect(l + 16, y, r - l - 32, 4);
      // Guaduas en las orillas.
      if ((((Math.floor(this.scrollY - y) % 28) + 28) % 28) < 4) g.fillStyle(hex('#7cbc4c'), 1).fillRect(l - 24, y, 3, 4).fillRect(r + 20, y, 3, 4);
    }
    // Ondas que bajan.
    const off = this.scrollY % 20;
    for (let y = -20 + off; y < BASE_HEIGHT; y += 20) {
      const [l, r] = this.bankAt(y);
      const row = Math.round((this.scrollY - y) / 20);
      for (let x = l + 20; x < r - 20; x += 34) g.fillStyle(hex('#5ab4c0'), 1).fillRect(x + (((row * 7) % 13) + 13) % 13, y, 8, 1);
    }
    for (const o of this.obstacles) {
      if (o.kind === 'piedra') {
        g.fillStyle(hex('#e8f8f4'), 0.7).fillEllipse(o.x, o.y + 4, o.r * 2.4, o.r);
        g.fillStyle(hex('#1c1c24'), 1).fillCircle(o.x, o.y, o.r + 1);
        g.fillStyle(hex('#9c968c'), 1).fillCircle(o.x, o.y, o.r);
        g.fillStyle(hex('#c8c2b4'), 1).fillCircle(o.x - o.r / 3, o.y - o.r / 3, o.r / 2.5);
      } else if (o.kind === 'rama') {
        g.fillStyle(hex('#5a3a20'), 1).fillRect(o.x - o.r, o.y - 2, o.r * 2, 4);
        for (let i = -1; i <= 1; i++) g.fillStyle(hex('#3c8040'), 1).fillCircle(o.x + i * o.r * 0.7, o.y - 3, 4);
      } else {
        for (let i = 0; i < 5; i++) g.fillStyle(hex('#e8f8f4'), 0.9).fillRect(o.x - o.r + i * 7, o.y - 3 + ((i * 3) % 5), 6, 2);
      }
    }
    // Danilo en su neumático (adelante) y tú.
    this.tubeAt(this.dan.x, 108, this.danilo, this.dan.hurt > 0);
    this.tubeAt(this.tube.x, 140, this.me, this.hitFlash > 0);
    this.bar(10, 22, 'Río', this.dist, '#58d4d0');
    this.infoText.setText(`Golpes: ${this.hits} · Danilo: ${this.dan.hits}`);
  }

  private tubeAt(x: number, y: number, who: HumanLook, hurt: boolean): void {
    const g = this.g;
    const bob = Math.sin(this.t * 4 + y) * 1.5 + (hurt ? Math.sin(this.t * 50) * 1.5 : 0);
    g.fillStyle(hex('#1c1c24'), 1).fillCircle(x, y + bob, 13);
    g.fillStyle(hex('#3a3a44'), 1).fillCircle(x, y + bob, 12);
    g.fillStyle(hex('#2a7c94'), 1).fillCircle(x, y + bob, 5);
    if (who === this.me || who === this.danilo) {
      bust(g, who, x, y - 6 + bob, 1.3, hurt ? { eyes: 'squint', mouth: 'o' } : { mouth: 'grin', eyes: 'squint' });
    }
  }

  // -------------------------------------------------------------------------
  // Puente
  // -------------------------------------------------------------------------

  private playPuente(dt: number, delta: number): void {
    // El puente se mece solo y, cada tanto, Danilo salta.
    this.jumpMs -= delta;
    let push = Math.sin(this.t * 1.6) * 0.5 + Math.sin(this.t * 3.1) * 0.2;
    if (this.jumpMs <= 0) {
      this.jumpMs = 2200 + Math.random() * 1800;
      this.leanV += (Math.random() < 0.5 ? -1 : 1) * (1.1 + this.walk / 120);
      playSfx('salto');
      this.say(['Danilo: «¡BOING!»', 'Danilo: «¿Se mueve? Yo no siento nada.»', 'Danilo: «¡Saltito!»', 'Danilo: «Perdón. ...Mentira, no perdón.»'][Math.floor(Math.random() * 4)], 200, 150, 1100);
    }
    if (this.grabMs > 0) {
      this.grabMs -= delta;
      this.lean *= 1 - 3 * dt;
      this.leanV = 0;
      return;
    }
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    const walking = Controls.isHeld('up');
    if (walking) push *= 1.4;
    this.leanV += (push * 1.6 + input * 2.6 - this.lean * 0.6) * dt;
    this.leanV *= 1 - 1.6 * dt;
    this.lean += this.leanV * dt;
    if (walking) this.walk = Math.min(100, this.walk + dt * 9);
    if (Math.abs(this.lean) > 1) {
      this.grabs++;
      this.grabMs = 1200;
      this.lean = Math.sign(this.lean) * 0.9;
      playSfx('golpe');
      this.say(['¡Del cable! ¡Del cable!', '¡Ay, ay, ay!', '¡Danilo, para!'][(this.grabs - 1) % 3], 160, 70, 1000);
      this.float('¡Agarrado!', '#ff9c9c', 160, 90);
    }
    if (this.walk >= 100) {
      this.score = Math.max(0, 5 - this.grabs);
      this.good = this.grabs <= 1;
      this.perfect = this.grabs === 0;
      this.endGame(
        this.perfect
          ? '¡La mitad del puente sin agarrarte una sola vez! Danilo deja de saltar, ofendido.'
          : this.good
            ? 'Llegaste a la mitad. Una agarradita al cable, nada más.'
            : `Llegaste a la mitad... agarrándote ${this.grabs} veces. El cable ya te conoce.`,
      );
    }
  }

  private drawPuente(): void {
    const g = this.g;
    // El puente en perspectiva: el río abajo, el bosque a los lados y las tablas que vienen hacia ti.
    g.fillStyle(hex('#7cb8e8'), 1).fillRect(0, 0, BASE_WIDTH, 50);
    g.fillStyle(hex('#4a7a5a'), 1).fillTriangle(0, 50, 80, 18, 170, 50).fillTriangle(120, 50, 230, 12, 320, 50);
    g.fillStyle(hex('#2c6a34'), 1).fillRect(0, 50, BASE_WIDTH, BASE_HEIGHT - 50);
    g.fillStyle(hex('#2a7c94'), 1).fillRect(0, 96, BASE_WIDTH, BASE_HEIGHT - 96);
    for (let i = 0; i < 12; i++) g.fillStyle(hex('#e8f8f4'), 0.8).fillRect((i * 61 + this.t * 30) % BASE_WIDTH, 110 + ((i * 17) % 60), 10, 1);
    const sway = this.lean * 16;
    const vanish = { x: 160 + sway * 0.3, y: 54 };
    const near = (side: -1 | 1): [number, number] => [160 + sway + side * 70, BASE_HEIGHT];
    // Tablas.
    const prog = (this.walk * 0.6) % 1;
    for (let i = 0; i < 14; i++) {
      const k = Math.pow((i + prog) / 14, 1.8);
      const y = vanish.y + (BASE_HEIGHT - vanish.y) * k;
      const w = 6 + 140 * k;
      const cx = vanish.x + (160 + sway - vanish.x) * k;
      if (i % 5 === 3) continue; // tabla que falta
      g.fillStyle(hex(i % 2 ? '#b08a5c' : '#9c7448'), 1).fillRect(cx - w / 2, y, w, Math.max(1, 6 * k));
    }
    // Cables.
    for (const side of [-1, 1] as const) {
      const [nx, ny] = near(side);
      g.lineStyle(2, 0xc8ccd4, 1).lineBetween(vanish.x + side * 4, vanish.y - 6, nx, ny - 60);
      g.lineStyle(1, 0x8c9098, 1).lineBetween(vanish.x + side * 3, vanish.y, nx, ny - 20);
      for (let i = 1; i < 8; i++) {
        const k = i / 8;
        g.lineStyle(1, 0x8c9098, 1).lineBetween(
          vanish.x + side * 4 + (nx - vanish.x - side * 4) * k,
          vanish.y - 6 + (ny - 60 - vanish.y + 6) * k,
          vanish.x + side * 3 + (nx - vanish.x - side * 3) * k,
          vanish.y + (ny - 20 - vanish.y) * k,
        );
      }
    }
    // Barra de equilibrio.
    g.fillStyle(0x0c1020, 0.75).fillRect(110, 20, 100, 10);
    g.fillStyle(0x58f0a0, 0.6).fillRect(145, 22, 30, 6);
    g.fillStyle(0xfbf6ee, 1).fillRect(160 + Phaser.Math.Clamp(this.lean, -1, 1) * 48 - 2, 21, 4, 8);
    this.bar(10, 36, 'Mitad', this.walk, '#e8c030');
    this.faces.clear();
    if (this.grabMs > 0) bust(this.faces, this.me, 40, 150, 2.4, { eyes: 'squint', mouth: 'o' });
    this.infoText.setText(`Agarradas: ${this.grabs}`);
  }

  // -------------------------------------------------------------------------
  // Fotos
  // -------------------------------------------------------------------------

  /** El panorama (más ancho que la pantalla): dónde está cada cosa. */
  private targets(): Array<{ id: string; name: string; x: number; y: number; r: number; ready: boolean }> {
    const jumping = Math.sin(this.t * 2.6) > 0.55;
    return [
      { id: 'salto', name: 'Danilo en el aire', x: 70, y: 58 - (jumping ? 10 : 0), r: 18, ready: jumping },
      { id: 'rio', name: 'El río verde', x: 250, y: 120, r: 30, ready: true },
      { id: 'farallones', name: 'Los Farallones', x: 430, y: 30, r: 30, ready: true },
      { id: 'barranquero', name: 'Un barranquero', x: this.bird.x, y: this.bird.y, r: 16, ready: this.bird.on },
    ];
  }

  private readonly PANO = 520;

  private playFotos(dt: number, delta: number): void {
    this.flashMs -= delta;
    if (!this.bird.on) {
      this.bird.next -= dt;
      if (this.bird.next <= 0 && !this.gotBird) {
        this.bird = { x: -20, y: 40 + Math.random() * 50, on: true, next: 6 + Math.random() * 5 };
        playSfx('cursor');
        this.say('Danilo: «¡Barranquero! ¡Rápido!»', 160, 150, 1300);
      }
    } else {
      this.bird.x += dt * 70;
      this.bird.y += Math.sin(this.t * 6) * 0.4;
      if (this.bird.x > this.PANO + 20) this.bird.on = false;
    }
    if (this.selfie) {
      this.faceT += dt;
      if (Controls.consume('interact')) {
        const both = this.selfieFaces().both;
        this.flashMs = 200;
        playSfx('camera');
        this.shots.push({ name: both ? 'La selfie de los dos' : 'Una selfie con Danilo haciendo caras', ok: both });
        this.float(both ? '¡Perfecta!' : 'Danilo salió raro...', both ? '#a8e0a0' : '#ff9c9c', 160, 60);
        this.endFotos();
      }
      return;
    }
    const sp = 120 * dt;
    if (Controls.isHeld('left')) this.view.x -= sp;
    if (Controls.isHeld('right')) this.view.x += sp;
    if (Controls.isHeld('up')) this.view.y -= sp;
    if (Controls.isHeld('down')) this.view.y += sp;
    this.view.x = Phaser.Math.Clamp(this.view.x, 40, this.PANO - 40);
    this.view.y = Phaser.Math.Clamp(this.view.y, 30, 140);
    if (Controls.consume('interact')) {
      this.flashMs = 200;
      playSfx('camera');
      let best: { id: string; name: string; d: number } | null = null;
      for (const tg of this.targets()) {
        if (!tg.ready) continue;
        const d = Math.hypot(tg.x - this.view.x, tg.y - this.view.y);
        if (d < tg.r + 12 && (!best || d < best.d)) best = { id: tg.id, name: tg.name, d };
      }
      if (best && !this.taken.has(best.id)) {
        this.taken.add(best.id);
        this.shots.push({ name: best.name, ok: true });
        if (best.id === 'barranquero') {
          this.gotBird = true;
          this.bird.on = false;
          playSfx('secret');
        }
        this.float(`¡${best.name}!`, '#a8e0a0', 160, 60);
      } else {
        this.shots.push({ name: 'Una foto movida', ok: false });
        this.float(best ? 'Repetida...' : 'Salió movida...', '#ff9c9c', 160, 60);
      }
      if (this.shots.length >= 3) {
        this.selfie = true;
        this.say('Danilo: «¡Ahora la selfie! Esperá que pongo cara...»', 160, 150, 1600);
      }
    }
  }

  private selfieFaces(): { me: 'grin' | 'o' | 'smile'; dan: 'grin' | 'o' | 'teeth' | 'smile'; danEyes: 'open' | 'closed' | 'squint'; both: boolean } {
    const k = Math.floor(this.faceT * 1.4) % 5;
    const dan = (['o', 'teeth', 'grin', 'smile', 'o'] as const)[k];
    const danEyes = (['closed', 'squint', 'squint', 'open', 'open'] as const)[k];
    const me = (['smile', 'grin', 'grin', 'o', 'smile'] as const)[(Math.floor(this.faceT * 1.1) + 1) % 5];
    return { me, dan, danEyes, both: dan === 'grin' && me === 'grin' };
  }

  private endFotos(): void {
    const ok = this.shots.filter((s) => s.ok).length;
    this.score = ok;
    this.good = ok >= 3;
    this.perfect = ok === 4 && this.gotBird;
    this.endGame(`${ok} de 4 fotos buenas${this.gotBird ? ', ¡y un barranquero!' : '.'}\n${this.shots.map((s) => `${s.ok ? '★' : '·'} ${s.name}`).join('\n')}`);
  }

  private drawFotos(): void {
    const g = this.g;
    const camX = Phaser.Math.Clamp(this.view.x - 160, 0, this.PANO - BASE_WIDTH);
    const X = (x: number): number => x - camX;
    this.faces.clear();
    if (this.selfie) {
      // La cámara frontal: tú y Danilo con el puente y el río atrás.
      g.fillStyle(hex('#7cb8e8'), 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
      g.fillStyle(hex('#2c6a34'), 1).fillRect(0, 60, BASE_WIDTH, 60);
      g.fillStyle(hex('#2a7c94'), 1).fillRect(0, 110, BASE_WIDTH, 70);
      g.lineStyle(2, 0xc8ccd4, 1).lineBetween(0, 70, BASE_WIDTH, 82);
      const f = this.selfieFaces();
      bust(this.faces, this.me, 130, 100, 4, { mouth: f.me, eyes: f.me === 'grin' ? 'squint' : 'open' });
      bust(this.faces, this.danilo, 196, 98, 4, { mouth: f.dan, eyes: f.danEyes });
      g.lineStyle(2, 0xfbf6ee, 0.9).strokeRoundedRect(40, 20, 240, 140, 8);
      this.infoText.setText('Selfie: E cuando sonrían los dos');
    } else {
      g.fillStyle(hex('#7cb8e8'), 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
      // Los Farallones a lo lejos (a la derecha del panorama), bosque, el río y el puente.
      g.fillStyle(hex('#5a7a8c'), 1).fillTriangle(X(330), 70, X(430), 10, X(520), 70);
      g.fillStyle(hex('#f4f0e6'), 0.8).fillTriangle(X(415), 20, X(430), 10, X(445), 20);
      g.fillStyle(hex('#3c8040'), 1).fillRect(0, 64, BASE_WIDTH, 50);
      for (let x = 0; x < this.PANO; x += 13) g.fillStyle(hex('#7cbc4c'), 1).fillRect(X(x), 50 + ((x * 7) % 14), 3, 60);
      g.fillStyle(hex('#2a7c94'), 1).fillRect(0, 106, BASE_WIDTH, 74);
      for (let i = 0; i < 24; i++) g.fillStyle(hex('#e8f8f4'), 0.9).fillRect(X((i * 37 + this.t * 25) % this.PANO), 112 + ((i * 13) % 60), 9, 1);
      g.fillStyle(hex('#9c968c'), 1).fillCircle(X(230), 130, 9).fillCircle(X(272), 146, 7);
      // El puente donde está Danilo (a la izquierda), con él saltando.
      g.lineStyle(2, 0xc8ccd4, 1).lineBetween(X(0), 66, X(150), 76);
      g.fillStyle(hex('#b08a5c'), 1).fillRect(X(0), 74, 150, 4);
      const jumping = Math.sin(this.t * 2.6) > 0.55;
      bust(this.faces, this.danilo, X(70), 60 - (jumping ? 10 : 0), 1.6, { mouth: jumping ? 'open' : 'grin', eyes: 'squint' });
      // El barranquero.
      if (this.bird.on) {
        const bx = X(this.bird.x);
        g.fillStyle(hex('#2c9cc8'), 1).fillEllipse(bx, this.bird.y, 12, 6);
        g.fillStyle(hex('#58d4d0'), 1).fillRect(bx - 16, this.bird.y - 1, 10, 2);
        g.fillStyle(hex('#1c1c24'), 1).fillRect(bx - 18, this.bird.y - 2, 3, 4);
        g.fillStyle(hex('#3c8040'), 1).fillTriangle(bx - 2, this.bird.y - 2, bx + 4, this.bird.y - 8 + Math.sin(this.t * 20) * 4, bx + 6, this.bird.y - 1);
      }
      // El visor.
      const vx = X(this.view.x);
      const vy = this.view.y;
      g.lineStyle(1, 0xfbf6ee, 1).strokeRect(vx - 34, vy - 24, 68, 48);
      g.lineStyle(1, 0xfbf6ee, 0.5).lineBetween(vx - 6, vy, vx + 6, vy).lineBetween(vx, vy - 6, vx, vy + 6);
      this.infoText.setText(`Fotos: ${this.shots.length}/3 · luego la selfie`);
    }
    if (this.flashMs > 0) g.fillStyle(0xffffff, Math.min(1, this.flashMs / 200)).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  }

  // -------------------------------------------------------------------------
  // Historia
  // -------------------------------------------------------------------------

  private playHistoria(delta: number): void {
    if (this.step >= 3) {
      this.postMs += delta;
      if (this.postMs > 600 && this.views < 23) {
        this.views = Math.min(23, Math.floor((this.postMs - 600) / 120));
      }
      if (this.postMs > 4200) {
        const full = this.pick[1] !== STICKERS.length - 1 && this.pick[2] !== TEXTS.length - 1;
        this.score = 1;
        this.good = full;
        this.perfect = full;
        this.endGame('Historia publicada.\nLas vistas empiezan a subir...');
      }
      return;
    }
    const n = [this.photos.length, STICKERS.length, TEXTS.length][this.step];
    if (Controls.consume('left')) {
      this.pick[this.step] = (this.pick[this.step] + n - 1) % n;
      playSfx('cursor');
    }
    if (Controls.consume('right')) {
      this.pick[this.step] = (this.pick[this.step] + 1) % n;
      playSfx('cursor');
    }
    if (Controls.consume('interact')) {
      playSfx('select');
      this.step++;
      if (this.step === 3) playSfx('enviado');
    }
  }

  private drawHistoria(): void {
    const g = this.g;
    g.fillStyle(hex('#1c1c24'), 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    // El celular, grande, al centro.
    const x0 = 110;
    const y0 = 18;
    const w = 100;
    const h = 150;
    g.fillStyle(hex('#0c0c10'), 1).fillRoundedRect(x0 - 4, y0 - 4, w + 8, h + 8, 8);
    // La foto elegida, dibujada según su nombre.
    const photo = this.photos[this.pick[0]] ?? '';
    this.drawPhoto(x0, y0, w, h, photo);
    this.faces.clear();
    if (photo.includes('selfie')) {
      bust(this.faces, this.me, x0 + 36, y0 + 82, 2.6, { mouth: 'grin', eyes: 'squint' });
      bust(this.faces, this.danilo, x0 + 66, y0 + 80, 2.6, { mouth: 'grin', eyes: 'squint' });
    } else if (photo.includes('Danilo')) {
      bust(this.faces, this.danilo, x0 + 50, y0 + 62, 2.6, { mouth: 'open', eyes: 'squint' });
    }
    // Sticker y texto.
    for (const t of this.extraTexts) t.destroy();
    this.extraTexts = [];
    const sticker = this.step >= 1 || this.step === 1 ? STICKERS[this.pick[1]] : '';
    const text = this.step >= 2 ? TEXTS[this.pick[2]] : '';
    if (sticker && sticker !== 'Sin sticker') {
      g.fillStyle(0xfbf6ee, 1).fillRoundedRect(x0 + 8, y0 + 18, 62, 13, 4);
      this.extraTexts.push(this.addText(x0 + 39, y0 + 20, sticker, { fontSize: '7px', fontStyle: '700', color: '#e8742c' }).setOrigin(0.5, 0).setDepth(42));
    }
    if (text && text !== 'Sin texto') {
      this.extraTexts.push(
        this.addText(x0 + w / 2, y0 + 110, text, { fontSize: '9px', fontStyle: '700', color: '#ffffff', stroke: '#14182a', strokeThickness: 3, align: 'center', wordWrap: { width: w - 10 } })
          .setOrigin(0.5, 0)
          .setDepth(42),
      );
    }
    // Barra de arriba de Fotogram.
    g.fillStyle(0xffffff, 0.9).fillRect(x0 + 4, y0 + 4, w - 8, 2);
    g.fillStyle(hex('#e868a8'), 1).fillCircle(x0 + 10, y0 + 11, 4);
    // Panel lateral: qué estás eligiendo.
    const labels = ['Foto', 'Sticker', 'Texto'];
    const values = [photo, STICKERS[this.pick[1]], TEXTS[this.pick[2]]];
    labels.forEach((lb, i) => {
      const active = i === this.step;
      const y = 40 + i * 34;
      g.fillStyle(active ? hex('#e868a8') : 0x2a2a34, 1).fillRoundedRect(220, y, 94, 26, 4);
      this.extraTexts.push(this.addText(224, y + 2, lb, { fontSize: '7px', color: active ? '#ffffff' : '#9c9ca8' }).setDepth(42));
      this.extraTexts.push(this.addText(224, y + 11, i <= this.step ? (active ? `‹ ${values[i]} ›` : values[i]) : '...', { fontSize: '7px', fontStyle: '600', color: '#ffffff', wordWrap: { width: 88 } }).setDepth(42));
    });
    if (this.step >= 3) {
      g.fillStyle(0x0c1020, 0.8).fillRect(x0, y0 + h - 22, w, 22);
      this.extraTexts.push(this.addText(x0 + w / 2, y0 + h - 19, this.postMs < 600 ? 'Publicando...' : `Visto por ${this.views}`, { fontSize: '8px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5, 0).setDepth(42));
      if (this.views >= 19) this.extraTexts.push(this.addText(x0 + w / 2, y0 + h - 9, 'laaurii_14', { fontSize: '7px', fontStyle: '700', color: '#f8dc68' }).setOrigin(0.5, 0).setDepth(42));
    } else {
      g.fillStyle(hex('#2f6fd0'), 1).fillRoundedRect(20, 140, 80, 18, 5);
      this.extraTexts.push(this.addText(60, 144, this.step === 2 ? 'E: publicar' : 'E: siguiente', { fontSize: '8px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5, 0).setDepth(42));
    }
  }

  private drawPhoto(x0: number, y0: number, w: number, h: number, photo: string): void {
    const g = this.g;
    if (photo.includes('selfie') || photo.includes('Danilo')) {
      g.fillStyle(hex('#7cb8e8'), 1).fillRect(x0, y0, w, h);
      g.fillStyle(hex('#2c6a34'), 1).fillRect(x0, y0 + 50, w, 50);
      g.fillStyle(hex('#2a7c94'), 1).fillRect(x0, y0 + 96, w, h - 96);
      g.lineStyle(2, 0xc8ccd4, 1).lineBetween(x0, y0 + 60, x0 + w, y0 + 70);
    } else if (photo.includes('Farallones')) {
      g.fillStyle(hex('#7cb8e8'), 1).fillRect(x0, y0, w, h);
      g.fillStyle(hex('#5a7a8c'), 1).fillTriangle(x0, y0 + 90, x0 + 50, y0 + 30, x0 + w, y0 + 90);
      g.fillStyle(hex('#f4f0e6'), 0.8).fillTriangle(x0 + 42, y0 + 40, x0 + 50, y0 + 30, x0 + 58, y0 + 40);
      g.fillStyle(hex('#3c8040'), 1).fillRect(x0, y0 + 90, w, h - 90);
    } else if (photo.includes('barranquero')) {
      g.fillStyle(hex('#3c8040'), 1).fillRect(x0, y0, w, h);
      g.fillStyle(hex('#5a3a20'), 1).fillRect(x0, y0 + 80, w, 4);
      g.fillStyle(hex('#2c9cc8'), 1).fillEllipse(x0 + 50, y0 + 74, 26, 14);
      g.fillStyle(hex('#58d4d0'), 1).fillRect(x0 + 20, y0 + 72, 20, 4);
      g.fillStyle(hex('#1c1c24'), 1).fillRect(x0 + 60, y0 + 68, 4, 4);
    } else {
      g.fillStyle(hex('#2a7c94'), 1).fillRect(x0, y0, w, h);
      g.fillStyle(hex('#3c9cac'), 1).fillRect(x0 + 14, y0, w - 28, h);
      for (let i = 0; i < 12; i++) g.fillStyle(hex('#e8f8f4'), 0.9).fillRect(x0 + 16 + ((i * 23) % (w - 40)), y0 + ((i * 29) % h), 12, 2);
      g.fillStyle(hex('#9c968c'), 1).fillCircle(x0 + 30, y0 + 70, 8).fillCircle(x0 + 70, y0 + 110, 10);
    }
  }

  // -------------------------------------------------------------------------

  private draw(): void {
    this.g.clear();
    if (this.mode === 'parquear') this.drawParquear();
    else if (this.mode === 'chorro') this.drawChorro();
    else if (this.mode === 'corriente') {
      this.faces.clear();
      this.drawCorriente();
    } else if (this.mode === 'puente') this.drawPuente();
    else if (this.mode === 'fotos') this.drawFotos();
    else this.drawHistoria();
    this.drawBars(this.g);
  }
}
