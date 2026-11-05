import Phaser from 'phaser';
import { playMusic, playSfx, setAmbient } from '../audio/sfx';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { formatClock, parseClock } from '../systems/Mission';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { drawPanel, THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

/**
 * Misión 5: Marco Polo en los carriles 7 y 8 de la piscina del Centro Deportivo de la PUCC (el «GLD»), de noche.
 * Dos principiantes (tú y Grover); pierde el que es «Marco» cuando suena el silbato. Marco nada con los ojos cerrados
 * y grita (F); el otro contesta «¡Polo!» y escapa. Al pillarlo, se cambian los papeles.
 *
 * Controles: WASD patalea (lento), E da una brazada (impulso; con buen ritmo, más), F grita.
 * El aire se gasta nadando y se recupera flotando quieto o agarrado de la pared o la corchera; sin aire,
 * te hundes un rato (burbujas) y avanzas lento. Primero, un largo de calentamiento (25 metros).
 * Vista cenital, cancha fija de 320×180 px.
 */

export interface PiscinaResult {
  /** Llegaste a la pared de enfrente en el calentamiento. */
  swam25: boolean;
  /** Veces que pillaste a Grover. */
  tags: number;
  /** Veces que Grover te pilló. */
  caught: number;
  /** El que es Marco cuando suena el silbato pierde. «nadie» si te saliste antes de tiempo. */
  winner: 'you' | 'grover' | 'nadie';
}

export interface PiscinaSceneData {
  done: (r: PiscinaResult) => void;
}

/** La parte de la piscina que se ve: los carriles 7 y 8 (libres, sin corchera entre ellos). */
const ARENA = { x: 18, y: 64, w: 284, h: 84 };
/** El carril 6, arriba (detrás de la corchera): ahí nada Sira, mariposa, ida y vuelta. */
const LANE6 = { y: 40, h: 20 };
const ROPE_Y = 61;
const R = 5;

const KICK_ACCEL = 80;
const KICK_MAX = 30;
const STROKE = 34;
const STROKE_GOOD = 52;
const MAX_SPEED = 64;
const DRAG = 2.0;
const STROKE_COOLDOWN = 0.32;
/** Ventana de «buen ritmo» después de la brazada anterior (s). */
const RHYTHM = [0.45, 0.9] as const;

const GAME_MS = 150_000;
const CLOCK_FROM = 'mar 19:02';
const CLOCK_TO = 'mar 19:56';
const MARCO_COOLDOWN = 1.3;
/** Grover grita «¡Marco!» cada tanto y tienes este tiempo para contestar. */
const POLO_WINDOW = 1.6;
const TAG_DIST = 11;
/** Cambio de papeles: lo que tardan en separarse. */
const SWAP_MS = 1800;
/** Al empezar un turno, un momento sin pilladas (por si acaso). */
const TAG_GRACE_MS = 1000;

const HINT_SWIM = 'WASD: patalear · E: brazada (con ritmo, más fuerte) · Esc: salir del agua';
const HINT_MARCO = 'Ojos cerrados · F: gritar «¡Marco!» y escuchar dónde contesta Grover';
const HINT_POLO = 'Grover es Marco · Cuando grite, F: «¡Polo!» (si no contestas, hace trampa)';

type Phase = 'intro' | 'warmup' | 'marco_you' | 'marco_grover' | 'swap' | 'end';

interface Swimmer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Aire 0..1. */
  air: number;
  /** Hundido: segundos que quedan tragando agua. */
  sink: number;
  strokeWait: number;
  sinceStroke: number;
  /** Fase de la brazada (animación de los brazos). */
  arm: number;
  facing: number;
  look: HumanLook;
  cap?: string;
}

interface Ring {
  x: number;
  y: number;
  t: number;
  color: number;
}

interface Splash {
  x: number;
  y: number;
  t: number;
  big: boolean;
}

export class PiscinaScene extends BaseScene {
  private done!: (r: PiscinaResult) => void;
  private g!: Phaser.GameObjects.Graphics;
  private fog!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private topText!: Phaser.GameObjects.Text;
  private roleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private bannerText!: Phaser.GameObjects.Text;
  private floatTexts: Phaser.GameObjects.Text[] = [];
  private me!: Swimmer;
  private grover!: Swimmer;
  private phase: Phase = 'intro';
  private phaseMs = 0;
  private gameMs = 0;
  private bannerMs = 0;
  private swam25 = false;
  private tags = 0;
  private caught = 0;
  private marcoWait = 0;
  /** Grover grita «¡Marco!»: cuánto falta para el próximo y si estás a tiempo de contestar. */
  private groverMarcoIn = 2.5;
  private poloWindow = 0;
  /** Adónde nada Grover cuando es Marco (lo último que escuchó), y si está haciendo trampa (mirando). */
  private groverTarget: { x: number; y: number } | null = null;
  private peekMs = 0;
  /** Grover escapando: hacia dónde y hasta cuándo, y si está agarrado de la corchera. */
  private fleeTarget = { x: 200, y: 100 };
  private fleeMs = 0;
  private coughMs = 0;
  private capLost = false;
  private eventIn = 14;
  private sira = { x: 30, dir: 1, t: 0 };
  private rings: Ring[] = [];
  private splashes: Splash[] = [];
  private bubbles: Array<{ x: number; y: number; t: number }> = [];
  private t = 0;
  private clockFrom = 0;
  private clockTo = 0;
  private finished = false;

  constructor() {
    super('Piscina');
    this.fixedCamera = true;
  }

  init(data: PiscinaSceneData): void {
    this.done = data.done;
    this.phase = 'intro';
    this.phaseMs = 0;
    this.gameMs = 0;
    this.bannerMs = 0;
    this.swam25 = false;
    this.tags = 0;
    this.caught = 0;
    this.marcoWait = 0;
    this.groverMarcoIn = 2.5;
    this.poloWindow = 0;
    this.groverTarget = null;
    this.peekMs = 0;
    this.fleeMs = 0;
    this.coughMs = 0;
    this.capLost = false;
    this.eventIn = 14;
    this.rings = [];
    this.splashes = [];
    this.bubbles = [];
    this.floatTexts = [];
    this.swapMoves = [];
    this.next = 'grover';
    this.winner = 'nadie';
    this.t = 0;
    this.finished = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#141a2c');
    this.g = this.add.graphics();
    this.fx = this.add.graphics().setDepth(5);
    this.fog = this.add.graphics().setDepth(6);
    this.hud = this.add.graphics().setDepth(10);
    const meLook = playerLook();
    this.me = this.swimmer(40, ARENA.y + ARENA.h - 18, meLook);
    const gLook = (characterLook('grover_bano') as HumanLook | undefined) ?? meLook;
    this.grover = this.swimmer(70, ARENA.y + 26, gLook, '#e84868');

    this.topText = this.addText(6, 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0f4ff' }).setDepth(11);
    this.roleText = this.addText(BASE_WIDTH / 2, 18, '', { fontSize: '10px', fontStyle: '600', color: '#f8e070', stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5, 0)
      .setDepth(11);
    this.hintText = this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 12, '', { fontSize: '8px', color: '#dfe6f4' }).setOrigin(0.5, 0).setDepth(11);
    this.bannerBg = this.add.graphics().setDepth(12);
    this.bannerText = this.addText(BASE_WIDTH / 2, 92, '', { fontSize: '12px', fontStyle: '600', color: THEME.ink, align: 'center', wordWrap: { width: 250 } })
      .setOrigin(0.5)
      .setDepth(13);

    this.clockFrom = parseClock(CLOCK_FROM);
    this.clockTo = parseClock(CLOCK_TO);
    StoryState.setClock(this.clockFrom, this.clockFrom);

    this.setupZoom();
    playMusic('piscina');
    setAmbient({ rain: 'none', indoor: false });
    this.cameras.main.fadeIn(400, 0, 0, 0);
    playSfx('splash');
    this.banner('¡Al agua!\nPrimero un largo: nada hasta la pared de enfrente (25 metros)', 3200);
    this.phase = 'warmup';
  }

  private swimmer(x: number, y: number, look: HumanLook, cap?: string): Swimmer {
    return { x, y, vx: 0, vy: 0, air: 1, sink: 0, strokeWait: 0, sinceStroke: 9, arm: 0, facing: 0, look, cap };
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    if (this.finished) {
      if (Controls.consume('interact') || Controls.consume('menu')) this.finish();
      this.render(dt);
      return;
    }
    if (Controls.consume('menu')) {
      this.end('Sales del agua antes de tiempo. Grover protesta desde la corchera: «¡Cobarde! ...Bueno, yo también me salgo».', true);
      return;
    }
    if (this.bannerMs > 0) {
      this.bannerMs -= delta;
      if (this.bannerMs <= 0) this.hideBanner();
    }

    this.phaseMs += delta;
    if (this.phase !== 'warmup') {
      this.gameMs += delta;
      StoryState.setClock(this.clockFrom + (this.clockTo - this.clockFrom) * Math.min(1, this.gameMs / GAME_MS), this.clockTo);
      if (this.gameMs >= GAME_MS) {
        playSfx('silbato');
        this.end('¡PIIIII! «¡Ocho en punto, muchachos! ¡Todo el mundo afuera!»');
        return;
      }
    }

    this.controlMe(dt);
    this.updateGrover(dt);
    for (const s of [this.me, this.grover]) this.swimPhysics(s, dt);
    this.updateSira(dt);
    this.updateEvents(dt);

    if (this.phase === 'warmup') {
      if (this.me.x > ARENA.x + ARENA.w - R - 4) {
        this.swam25 = true;
        playSfx('select');
        this.say(this.me, '¡25 metros!', '#f8e070');
        this.startMarcoYou(true);
      } else if (this.phaseMs > 45_000) {
        this.say(this.grover, '¡Ya, cumpa, juguemos!', '#ffffff');
        this.startMarcoYou(true);
      }
    } else if (this.phase === 'marco_you') {
      if (this.phaseMs > TAG_GRACE_MS && Math.hypot(this.me.x - this.grover.x, this.me.y - this.grover.y) < TAG_DIST) this.tag(true);
    } else if (this.phase === 'marco_grover') {
      if (this.phaseMs > TAG_GRACE_MS && Math.hypot(this.me.x - this.grover.x, this.me.y - this.grover.y) < TAG_DIST) this.tag(false);
    } else if (this.phase === 'swap') {
      // Cada uno nada a su sitio (suave), sin depender de la física ni de las paredes.
      const k = Phaser.Math.Easing.Sine.InOut(Math.min(1, this.phaseMs / SWAP_MS));
      for (const m of this.swapMoves) {
        const nx = m.fx + (m.tx - m.fx) * k;
        const ny = m.fy + (m.ty - m.fy) * k;
        if (Math.hypot(nx - m.s.x, ny - m.s.y) > 0.01) m.s.facing = Math.atan2(ny - m.s.y, nx - m.s.x);
        m.s.x = nx;
        m.s.y = ny;
        m.s.vx = 0;
        m.s.vy = 0;
        if (Math.random() < dt * 5) this.splashes.push({ x: m.s.x - Math.cos(m.s.facing) * 7, y: m.s.y - Math.sin(m.s.facing) * 7, t: 0, big: false });
      }
      if (this.phaseMs > SWAP_MS) {
        this.swapMoves = [];
        if (this.next === 'you') this.startMarcoYou(false);
        else this.startMarcoGrover();
      }
    }
    this.render(dt);
  }

  private next: 'you' | 'grover' = 'grover';
  /** Durante el cambio de papeles: de dónde a dónde nada cada uno. */
  private swapMoves: Array<{ s: Swimmer; fx: number; fy: number; tx: number; ty: number }> = [];

  // -------------------------------------------------------------------------
  // Tú
  // -------------------------------------------------------------------------

  private controlMe(dt: number): void {
    const s = this.me;
    if (this.phase === 'swap' || this.phase === 'intro') return;
    let ix = 0;
    let iy = 0;
    if (Controls.isHeld('left')) ix -= 1;
    if (Controls.isHeld('right')) ix += 1;
    if (Controls.isHeld('up')) iy -= 1;
    if (Controls.isHeld('down')) iy += 1;
    const len = Math.hypot(ix, iy);
    const sinking = s.sink > 0;
    if (len > 0) {
      ix /= len;
      iy /= len;
      s.facing = Math.atan2(iy, ix);
      // Patalear: lento, pero gasta poco aire.
      const max = sinking ? 9 : KICK_MAX;
      if (Math.hypot(s.vx, s.vy) < max) {
        s.vx += ix * KICK_ACCEL * dt;
        s.vy += iy * KICK_ACCEL * dt;
      }
      s.air -= 0.035 * dt;
      if (Math.random() < dt * 6) this.splashes.push({ x: s.x - Math.cos(s.facing) * 7, y: s.y - Math.sin(s.facing) * 7, t: 0, big: false });
    }
    s.strokeWait -= dt;
    s.sinceStroke += dt;
    if (Controls.consume('interact') && s.strokeWait <= 0 && !sinking) {
      const good = s.sinceStroke >= RHYTHM[0] && s.sinceStroke <= RHYTHM[1];
      const power = good ? STROKE_GOOD : STROKE;
      s.vx += Math.cos(s.facing) * power;
      s.vy += Math.sin(s.facing) * power;
      s.air -= good ? 0.045 : 0.07;
      s.strokeWait = STROKE_COOLDOWN;
      s.sinceStroke = 0;
      s.arm = 1;
      playSfx('splash');
      this.splashes.push({ x: s.x, y: s.y, t: 0, big: good });
      if (good && Math.random() < 0.25) this.say(s, '¡Buen ritmo!', '#a8f0a0');
    }
    if (Controls.consume('trick')) this.shout();
  }

  /** F: «¡Marco!» si eres Marco; «¡Polo!» si Grover acaba de gritar. */
  private shout(): void {
    if (this.phase === 'marco_you') {
      if (this.marcoWait > 0) return;
      this.marcoWait = MARCO_COOLDOWN;
      playSfx('marco');
      this.say(this.me, '¡MARCO!', '#f8e070');
      this.time.delayedCall(380 + Math.random() * 300, () => {
        if (this.phase !== 'marco_you') return;
        playSfx('polo');
        this.rings.push({ x: this.grover.x, y: this.grover.y, t: 0, color: 0xf86890 });
        this.floatText(this.grover.x, this.grover.y - 12, '¡POLO!', '#ff9ab8');
      });
    } else if (this.phase === 'marco_grover') {
      playSfx('polo');
      this.say(this.me, '¡POLO!', '#a8e0ff');
      if (this.poloWindow > 0) {
        this.poloWindow = 0;
        // Grover nada hacia donde escuchó la voz (con su error de cálculo).
        this.groverTarget = { x: this.me.x + (Math.random() - 0.5) * 30, y: this.me.y + (Math.random() - 0.5) * 22 };
      } else {
        // Gritar «¡Polo!» sin que te pregunten: Grover lo escucha igual. Error de principiante.
        this.groverTarget = { x: this.me.x, y: this.me.y };
        this.say(this.grover, '¡Te escuché, jajaja!', '#ffffff');
      }
    } else if (this.phase === 'warmup') {
      playSfx('marco');
      this.say(this.me, '¡Grover!', '#ffffff');
      this.say(this.grover, '¿Qué, cumpa? ¡Nadá, nadá!', '#ffffff');
    }
  }

  // -------------------------------------------------------------------------
  // Grover
  // -------------------------------------------------------------------------

  private updateGrover(dt: number): void {
    const s = this.grover;
    this.marcoWait -= dt;
    if (this.coughMs > 0) {
      this.coughMs -= dt * 1000;
      return;
    }
    let tx = s.x;
    let ty = s.y;
    let speed = 0;
    if (this.phase === 'warmup') {
      // Calentando: nada «estilo perrito» de un lado a otro, mirándote.
      tx = this.me.x + 30 * Math.sin(this.t * 0.7);
      ty = ARENA.y + 22;
      speed = 22;
    } else if (this.phase === 'marco_you') {
      // Escapa: elige un punto lejos de ti; a veces descansa agarrado de la corchera.
      this.fleeMs -= dt * 1000;
      const d = Math.hypot(this.me.x - s.x, this.me.y - s.y);
      if (this.fleeMs <= 0 || Math.hypot(this.fleeTarget.x - s.x, this.fleeTarget.y - s.y) < 6) {
        this.fleeMs = 1600 + Math.random() * 1800;
        const rest = s.air < 0.4 && Math.random() < 0.6;
        const awayX = s.x + (s.x - this.me.x) * 1.4 + (Math.random() - 0.5) * 60;
        this.fleeTarget = rest
          ? { x: Phaser.Math.Clamp(s.x + (Math.random() - 0.5) * 40, ARENA.x + 8, ARENA.x + ARENA.w - 8), y: ARENA.y + R + 1 }
          : { x: Phaser.Math.Clamp(awayX, ARENA.x + 10, ARENA.x + ARENA.w - 10), y: ARENA.y + 10 + Math.random() * (ARENA.h - 20) };
      }
      tx = this.fleeTarget.x;
      ty = this.fleeTarget.y;
      speed = d < 50 ? 30 : 18;
    } else if (this.phase === 'marco_grover') {
      // Grover es Marco: grita cada tanto y nada hacia lo último que escuchó (o hacia ti, si hace trampa).
      this.groverMarcoIn -= dt;
      if (this.poloWindow > 0) {
        this.poloWindow -= dt;
        if (this.poloWindow <= 0) {
          this.peekMs = 2200;
          this.say(s, '¡Tenés que decir Polo, tramposo! ...(abre un ojo)', '#ffffff');
        }
      }
      if (this.groverMarcoIn <= 0) {
        this.groverMarcoIn = 2.6 + Math.random() * 1.6;
        this.poloWindow = POLO_WINDOW;
        playSfx('marco');
        this.say(s, '¡MARCO!', '#f8e070');
      }
      if (this.peekMs > 0) {
        this.peekMs -= dt * 1000;
        this.groverTarget = { x: this.me.x, y: this.me.y };
      }
      if (this.groverTarget) {
        tx = this.groverTarget.x;
        ty = this.groverTarget.y;
        speed = this.peekMs > 0 ? 28 : 24;
        if (Math.hypot(tx - s.x, ty - s.y) < 5) this.groverTarget = null;
      } else {
        // Sin pistas: da vueltas con los brazos estirados.
        tx = s.x + Math.cos(this.t * 1.3) * 20;
        ty = s.y + Math.sin(this.t * 1.1) * 14;
        speed = 10;
      }
    }
    const dx = tx - s.x;
    const dy = ty - s.y;
    const len = Math.hypot(dx, dy);
    if (len > 1 && speed > 0) {
      s.facing = Math.atan2(dy, dx);
      const max = s.sink > 0 ? 7 : speed;
      if (Math.hypot(s.vx, s.vy) < max) {
        s.vx += (dx / len) * KICK_ACCEL * 0.8 * dt;
        s.vy += (dy / len) * KICK_ACCEL * 0.8 * dt;
      }
      s.air -= 0.03 * dt;
      s.sinceStroke += dt;
      // De vez en cuando, una brazada desesperada.
      if (s.sinceStroke > 1.1 && Math.random() < dt * 1.6 && s.sink <= 0) {
        s.vx += Math.cos(s.facing) * STROKE * 0.8;
        s.vy += Math.sin(s.facing) * STROKE * 0.8;
        s.sinceStroke = 0;
        s.arm = 1;
        s.air -= 0.05;
        this.splashes.push({ x: s.x, y: s.y, t: 0, big: true });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Física y aire
  // -------------------------------------------------------------------------

  private swimPhysics(s: Swimmer, dt: number): void {
    const k = Math.max(0, 1 - DRAG * dt);
    s.vx *= k;
    s.vy *= k;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > MAX_SPEED) {
      s.vx *= MAX_SPEED / sp;
      s.vy *= MAX_SPEED / sp;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // Paredes y corchera: rebote suave.
    const minX = ARENA.x + R;
    const maxX = ARENA.x + ARENA.w - R;
    const minY = ARENA.y + R;
    const maxY = ARENA.y + ARENA.h - R;
    if (s.x < minX) (s.x = minX), (s.vx = Math.abs(s.vx) * 0.3);
    if (s.x > maxX) (s.x = maxX), (s.vx = -Math.abs(s.vx) * 0.3);
    if (s.y < minY) (s.y = minY), (s.vy = Math.abs(s.vy) * 0.3);
    if (s.y > maxY) (s.y = maxY), (s.vy = -Math.abs(s.vy) * 0.3);
    s.arm = Math.max(0, s.arm - dt * 3);

    // Aire: agarrado del borde se recupera rápido; flotando quieto, lento.
    const atEdge = s.x <= minX + 2 || s.x >= maxX - 2 || s.y <= minY + 2 || s.y >= maxY - 2;
    const still = Math.hypot(s.vx, s.vy) < 6;
    if (s.sink > 0) {
      s.sink -= dt;
      if (Math.random() < dt * 14) this.bubbles.push({ x: s.x + (Math.random() - 0.5) * 6, y: s.y, t: 0 });
      s.air = Math.min(1, s.air + 0.12 * dt);
    } else {
      s.air = Math.min(1, s.air + (atEdge ? 0.4 : still ? 0.1 : 0) * dt);
      if (s.air <= 0) {
        s.air = 0.05;
        s.sink = 2.2;
        playSfx('splash');
        this.say(s, s === this.me ? '¡Glu, glu, glu!' : '¡Pucha! ¡Glup!', '#a8e0ff');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Turnos de Marco Polo
  // -------------------------------------------------------------------------

  private startMarcoYou(first: boolean): void {
    this.phase = 'marco_you';
    this.phaseMs = 0;
    this.marcoWait = 0.4;
    this.fleeMs = 0;
    this.banner(first ? '¡MARCO POLO!\nEres Marco: cierras los ojos. F grita «¡Marco!»; Grover contesta «¡Polo!». ¡Píllalo!' : 'Ahora eres Marco: ojos cerrados. F para gritar.', first ? 3800 : 2200);
  }

  private startMarcoGrover(): void {
    this.phase = 'marco_grover';
    this.phaseMs = 0;
    this.groverMarcoIn = 1.6;
    this.poloWindow = 0;
    this.groverTarget = null;
    this.peekMs = 0;
    this.banner('Grover es Marco.\nCuando grite «¡Marco!», contesta «¡Polo!» con F... y escápate.', 2600);
  }

  private tag(you: boolean): void {
    if (you) {
      this.tags++;
      playSfx('select');
      this.say(this.grover, ['¡Pucha! ¡Me pillaste!', '¡Noooo! ¡Hacías trampa!', '¡Ya, ya, me toca!'][this.tags % 3], '#ffffff');
      this.say(this.me, '¡TE PILLÉ!', '#f8e070');
      this.next = 'grover';
    } else {
      this.caught++;
      playSfx('select');
      this.say(this.grover, ['¡TE PILLÉ, CUMPA!', '¡Jajaja! Te encontré por la colonia de Fredy', '¡Pillado! ¡Bolivia gana! Digo, nadie gana'][this.caught % 3], '#f8e070');
      this.next = 'you';
    }
    // Se separan de verdad para que el cambio no termine en pillada inmediata (en una esquina, un simple
    // empujón choca con la pared y quedaban pegados: bucle infinito de pilladas). El nuevo Marco se queda
    // cerca de donde está (lejos de las paredes) y el que escapa nada hacia el otro lado de la piscina.
    const marco = you ? this.grover : this.me;
    const polo = you ? this.me : this.grover;
    const mx = Phaser.Math.Clamp(marco.x, ARENA.x + 24, ARENA.x + ARENA.w - 24);
    const my = Phaser.Math.Clamp(marco.y, ARENA.y + 16, ARENA.y + ARENA.h - 16);
    const px = mx < ARENA.x + ARENA.w / 2 ? ARENA.x + ARENA.w - 30 - Math.random() * 40 : ARENA.x + 30 + Math.random() * 40;
    const py = ARENA.y + 16 + Math.random() * (ARENA.h - 32);
    this.swapMoves = [
      { s: marco, fx: marco.x, fy: marco.y, tx: mx, ty: my },
      { s: polo, fx: polo.x, fy: polo.y, tx: px, ty: py },
    ];
    this.phase = 'swap';
    this.phaseMs = 0;
    this.poloWindow = 0;
    this.splashes.push({ x: (this.me.x + this.grover.x) / 2, y: (this.me.y + this.grover.y) / 2, t: 0, big: true });
  }

  // -------------------------------------------------------------------------
  // Lo que pasa alrededor: Sira en el carril 6, Grover que traga agua, un niño que se tira bomba...
  // -------------------------------------------------------------------------

  private updateSira(dt: number): void {
    const sp = 70;
    this.sira.x += this.sira.dir * sp * dt;
    this.sira.t += dt;
    if (this.sira.x > ARENA.x + ARENA.w - 8) (this.sira.dir = -1), (this.sira.x = ARENA.x + ARENA.w - 8);
    if (this.sira.x < ARENA.x + 8) (this.sira.dir = 1), (this.sira.x = ARENA.x + 8);
    if (Math.random() < dt * 5) this.splashes.push({ x: this.sira.x - this.sira.dir * 8, y: LANE6.y + LANE6.h / 2, t: 0, big: false });
  }

  private updateEvents(dt: number): void {
    if (this.phase === 'warmup' || this.phase === 'swap') return;
    this.eventIn -= dt;
    if (this.eventIn > 0) return;
    this.eventIn = 12 + Math.random() * 10;
    const pick = Math.floor(Math.random() * 4);
    if (pick === 0) {
      // Grover traga agua y tose: se queda quieto un rato.
      this.coughMs = 1800;
      this.grover.vx = 0;
      this.grover.vy = 0;
      playSfx('splash');
      this.say(this.grover, '¡GLUP! ¡Cof, cof! ¡Me tomé media piscina!', '#ffffff');
    } else if (pick === 1) {
      // Un niño se tira bomba desde el borde: la ola los empuja.
      playSfx('chapuzon');
      const x = ARENA.x + 30 + Math.random() * (ARENA.w - 60);
      const y = ARENA.y + ARENA.h - 4;
      this.splashes.push({ x, y, t: 0, big: true }, { x: x + 6, y: y - 4, t: 0, big: true });
      for (const s of [this.me, this.grover]) {
        const a = Math.atan2(s.y - y, s.x - x);
        const f = Math.max(0, 60 - Math.hypot(s.x - x, s.y - y) * 0.4);
        s.vx += Math.cos(a) * f;
        s.vy += Math.sin(a) * f;
      }
      this.floatText(x, y - 10, '¡BOMBAAA!', '#ffffff');
    } else if (pick === 2) {
      // Sira pasa haciendo mariposa y se ríe.
      this.floatText(this.sira.x, LANE6.y - 2, 'jajaja', '#ffd0e0');
      this.say(this.grover, '¿Viste a la del carril 6? ¡Nada como pez!', '#ffffff');
    } else {
      if (!this.capLost) {
        this.capLost = true;
        this.grover.cap = undefined;
        this.say(this.grover, '¡Mi gorro! ¡Se me salió el mullet!', '#ffffff');
      } else {
        playSfx('silbato');
        this.floatText(BASE_WIDTH - 40, ARENA.y + ARENA.h + 6, '¡Sin correr!', '#ffe070');
        this.say(this.me, '¡Si estamos nadando!', '#ffffff');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private render(dt: number): void {
    const g = this.g;
    g.clear();
    // Fondo: el borde de baldosas, la noche y los reflectores.
    g.fillStyle(0x1a2238, 1).fillRect(0, 0, BASE_WIDTH, 30);
    g.fillStyle(0xd8d4c8, 1).fillRect(0, 30, BASE_WIDTH, BASE_HEIGHT - 30);
    for (let x = 0; x < BASE_WIDTH; x += 8) g.fillStyle(0xc4bfb2, 1).fillRect(x, 30, 1, BASE_HEIGHT - 30);
    for (const lx of [40, 160, 280]) {
      g.fillStyle(0x6a6e78, 1).fillRect(lx, 4, 2, 26);
      g.fillStyle(0xfff6c8, 1).fillRect(lx - 4, 2, 10, 4);
      g.fillStyle(0xfff6c8, 0.07).fillTriangle(lx - 4, 6, lx + 6, 6, lx + 30, 60);
    }
    // Agua: carril 6 arriba y los carriles 7-8, con cáusticas que se mueven.
    const top = LANE6.y - 4;
    const bottom = ARENA.y + ARENA.h + 2;
    g.fillStyle(0xf4f2ea, 1).fillRect(ARENA.x - 6, top - 4, ARENA.w + 12, bottom - top + 8);
    g.fillStyle(0x2a8ad0, 1).fillRect(ARENA.x - 2, top, ARENA.w + 4, bottom - top);
    for (let i = 0; i < 46; i++) {
      const cx = (ARENA.x + ((i * 61 + this.t * (8 + (i % 5) * 3)) % ARENA.w)) | 0;
      const cy = (top + ((i * 37) % (bottom - top - 2))) | 0;
      g.fillStyle(i % 3 ? 0x5cbcf0 : 0x9ce0ff, 0.6).fillRect(cx, cy, 3 + (i % 4), 1);
    }
    // Líneas negras del fondo de los carriles 7 y 8.
    g.fillStyle(0x123c78, 0.7).fillRect(ARENA.x + 10, ARENA.y + 20, ARENA.w - 20, 3).fillRect(ARENA.x + 10, ARENA.y + ARENA.h - 22, ARENA.w - 20, 3);
    g.fillStyle(0x123c78, 0.7).fillRect(ARENA.x + 10, LANE6.y + LANE6.h / 2 - 1, ARENA.w - 20, 3);
    // Corchera entre el carril 6 y el 7.
    for (let x = ARENA.x - 2; x < ARENA.x + ARENA.w + 2; x += 5) {
      g.fillStyle(0x2a2433, 1).fillRect(x, ROPE_Y - 2, 5, 5);
      g.fillStyle(Math.floor(x / 5) % 3 === 0 ? 0xd83838 : Math.floor(x / 5) % 3 === 1 ? 0xf4f4f0 : 0x2f5fb0, 1).fillRect(x, ROPE_Y - 1, 4, 3);
    }
    // El salvavidas en su silla alta (abajo a la derecha) y la escalerita (abajo a la izquierda).
    g.fillStyle(0x7c808c, 1).fillRect(BASE_WIDTH - 24, bottom + 4, 2, 14).fillRect(BASE_WIDTH - 14, bottom + 4, 2, 14);
    g.fillStyle(0xd83838, 1).fillRect(BASE_WIDTH - 26, bottom + 2, 16, 4);
    g.fillStyle(0x8a5a3c, 1).fillRect(BASE_WIDTH - 21, bottom - 4, 6, 6);
    g.fillStyle(0xf0c030, 1).fillRect(BASE_WIDTH - 21, bottom - 5, 6, 2);
    g.fillStyle(0xa8acb4, 1).fillRect(ARENA.x + 6, bottom - 6, 1, 8).fillRect(ARENA.x + 12, bottom - 6, 1, 8);
    // La pared de enfrente, marcada en el calentamiento.
    if (this.phase === 'warmup') {
      const blink = Math.floor(this.t * 3) % 2 === 0;
      g.fillStyle(0xf8e070, blink ? 0.9 : 0.4).fillRect(ARENA.x + ARENA.w - 3, ARENA.y + 2, 3, ARENA.h - 4);
    }

    // Sira, mariposa en el carril 6.
    this.drawSira(g);

    this.drawSwimmer(g, this.grover, this.phase === 'marco_grover' && this.peekMs <= 0);
    this.drawSwimmer(g, this.me, this.phase === 'marco_you');

    // Efectos: salpicones y burbujas.
    const fx = this.fx;
    fx.clear();
    this.splashes = this.splashes.filter((s) => (s.t += dt) < (s.big ? 0.6 : 0.35));
    for (const s of this.splashes) {
      const k = s.t / (s.big ? 0.6 : 0.35);
      const r = (s.big ? 10 : 5) * k + 2;
      fx.lineStyle(1, 0xffffff, 1 - k).strokeCircle(s.x, s.y, r);
      if (s.big) for (let i = 0; i < 6; i++) fx.fillStyle(0xe8f8ff, 1 - k).fillRect(s.x + Math.cos(i) * r * 1.2, s.y + Math.sin(i * 1.7) * r, 1, 1);
    }
    this.bubbles = this.bubbles.filter((b) => (b.t += dt) < 0.8);
    for (const b of this.bubbles) fx.lineStyle(1, 0xd8f4ff, 1 - b.t / 0.8).strokeCircle(b.x + Math.sin(b.t * 9) * 2, b.y - b.t * 10, 1.5);

    // Ojos cerrados: todo oscuro menos un poquito alrededor tuyo.
    const fog = this.fog;
    fog.clear();
    if (this.phase === 'marco_you') {
      const cell = 5;
      for (let y = 30; y < BASE_HEIGHT; y += cell) {
        for (let x = 0; x < BASE_WIDTH; x += cell) {
          const d = Math.hypot(x + cell / 2 - this.me.x, y + cell / 2 - this.me.y);
          const a = Phaser.Math.Clamp((d - 14) / 22, 0, 0.93);
          if (a > 0.02) fog.fillStyle(0x05060c, a).fillRect(x, y, cell, cell);
        }
      }
      // Las paredes se adivinan apenas (para no perderse).
      fog.lineStyle(1, 0x3a5a8a, 0.5).strokeRect(ARENA.x - 1, ARENA.y - 1, ARENA.w + 2, ARENA.h + 2);
    }
    // Los «¡Polo!» se ven aunque tengas los ojos cerrados (se escuchan).
    this.rings = this.rings.filter((r) => (r.t += dt) < 1.1);
    for (const r of this.rings) {
      const k = r.t / 1.1;
      fog.lineStyle(2, r.color, 1 - k).strokeCircle(r.x, r.y, 4 + 22 * k);
      fog.lineStyle(1, r.color, (1 - k) * 0.7).strokeCircle(r.x, r.y, 2 + 12 * k);
    }

    this.drawHud();
  }

  private drawSira(g: Phaser.GameObjects.Graphics): void {
    const x = this.sira.x;
    const y = LANE6.y + LANE6.h / 2;
    const flap = Math.sin(this.sira.t * 10);
    g.fillStyle(0xf0d8c8, 0.55).fillEllipse(x - this.sira.dir * 6, y, 14, 5);
    // Brazos de mariposa: los dos a la vez.
    g.fillStyle(0xf8e2d4, 1).fillRect(x - 1 + this.sira.dir * (2 + flap * 3), y - 7, 2, 4).fillRect(x - 1 + this.sira.dir * (2 + flap * 3), y + 3, 2, 4);
    g.fillStyle(0x2a2433, 1).fillCircle(x, y, 4);
    g.fillStyle(0xd84848, 1).fillCircle(x, y, 3);
  }

  /** Nadador visto desde arriba: el cuerpo bajo el agua, los brazos y la cabeza (pelo, gorro, cara). */
  private drawSwimmer(g: Phaser.GameObjects.Graphics, s: Swimmer, eyesClosed: boolean): void {
    const hex = (c: string): number => Phaser.Display.Color.HexStringToColor(c).color;
    const fx = Math.cos(s.facing);
    const fy = Math.sin(s.facing);
    const sinkOff = s.sink > 0 ? 0.45 : 1;
    // Cuerpo bajo el agua (borroso) con el traje de baño.
    g.fillStyle(hex(s.look.skin), 0.45 * sinkOff).fillEllipse(s.x - fx * 8, s.y - fy * 8, 9 + Math.abs(fx) * 8, 9 + Math.abs(fy) * 8);
    g.fillStyle(hex(s.look.pants), 0.5 * sinkOff).fillCircle(s.x - fx * 11, s.y - fy * 11, 3);
    // Pies que patalean.
    const kick = Math.sin(this.t * 14) * 2;
    g.fillStyle(hex(s.look.skin), 0.5 * sinkOff).fillRect(s.x - fx * 16 - fy * (2 + kick) - 1, s.y - fy * 16 + fx * (2 + kick) - 1, 2, 2);
    g.fillStyle(hex(s.look.skin), 0.5 * sinkOff).fillRect(s.x - fx * 16 + fy * (2 - kick) - 1, s.y - fy * 16 - fx * (2 - kick) - 1, 2, 2);
    // Brazos: estirados adelante (Marco con los ojos cerrados busca a tientas) o dando la brazada.
    const reach = eyesClosed ? 9 : 4 + s.arm * 6;
    for (const side of [-1, 1]) {
      const ax = s.x + fx * reach - fy * side * 5;
      const ay = s.y + fy * reach + fx * side * 5;
      g.fillStyle(hex(s.look.skin), 1).fillCircle(ax, ay, 1.6);
    }
    // Cabeza.
    g.fillStyle(0x2a2433, 1).fillCircle(s.x, s.y, R + 0.5);
    g.fillStyle(hex(s.look.skin), 1).fillCircle(s.x, s.y, R - 0.5);
    const hairColor = hex(s.cap ?? s.look.hair);
    if (s.look.hairStyle !== 'bald' || s.cap) {
      // Pelo o gorro: la mitad de atrás de la cabeza (lo contrario a donde mira).
      g.fillStyle(hairColor, 1).fillCircle(s.x - fx * 1.8, s.y - fy * 1.8, R - 1);
    }
    if (s.look.hairStyle === 'mullet' && !s.cap) {
      // El mullet de Grover flota detrás, en el agua.
      g.fillStyle(hex(s.look.hair), 0.9).fillEllipse(s.x - fx * 7, s.y - fy * 7, 5 + Math.abs(fy) * 3, 5 + Math.abs(fx) * 3);
    }
    // Cara: ojos (abiertos, cerrados o uno abierto si hace trampa) hacia adelante.
    const ex = s.x + fx * 2.5;
    const ey = s.y + fy * 2.5;
    const eyeColor = 0x202028;
    for (const side of [-1, 1]) {
      const px = ex - fy * side * 1.8;
      const py = ey + fx * side * 1.8;
      if (eyesClosed) g.fillStyle(eyeColor, 1).fillRect(px - 1, py, 2, 1);
      else g.fillStyle(eyeColor, 1).fillRect(px - 0.5, py - 0.5, 1, 1);
    }
    if (s.look.extras?.includes('unibrow')) g.fillStyle(hex(s.look.hair), 1).fillRect(ex - 3 - fx, ey - 2.5, 6, 1);
    if (s === this.grover && this.peekMs > 0) g.fillStyle(0xffffff, 1).fillRect(ex + 1, ey - 1, 2, 2);
  }

  private drawHud(): void {
    const h = this.hud;
    h.clear();
    // Barra de aire.
    const air = this.me.air;
    h.fillStyle(0x14182a, 0.8).fillRoundedRect(BASE_WIDTH - 76, 3, 72, 12, 3);
    h.fillStyle(0x3a4060, 1).fillRect(BASE_WIDTH - 52, 7, 44, 4);
    h.fillStyle(this.me.sink > 0 ? 0xe85a5a : air < 0.3 ? 0xf0c030 : 0x58c8f0, 1).fillRect(BASE_WIDTH - 52, 7, Math.round(44 * Phaser.Math.Clamp(air, 0, 1)), 4);
    const clock = formatClock(StoryState.clock);
    this.topText.setText('AIRE').setPosition(BASE_WIDTH - 74, 4);
    const left = this.phase === 'warmup' ? 'CALENTAMIENTO' : 'MARCO POLO';
    this.roleText.setText(
      this.phase === 'marco_you' ? 'ERES MARCO (ojos cerrados)' : this.phase === 'marco_grover' ? (this.poloWindow > 0 ? '¡F: «POLO»!' : 'GROVER ES MARCO') : '',
    );
    this.roleText.setColor(this.poloWindow > 0 ? '#ff9ab8' : '#f8e070');
    h.fillStyle(0x14182a, 0.8).fillRoundedRect(3, 3, 120, 12, 3);
    if (!this.leftText) this.leftText = this.addText(7, 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0f4ff' }).setDepth(11);
    this.leftText.setText(`${left} · ${clock}`);
    this.hintText.setText(this.phase === 'marco_you' ? HINT_MARCO : this.phase === 'marco_grover' ? HINT_POLO : HINT_SWIM);
    h.fillStyle(0x14182a, 0.75).fillRect(0, BASE_HEIGHT - 13, BASE_WIDTH, 13);
  }

  private leftText?: Phaser.GameObjects.Text;

  // -------------------------------------------------------------------------
  // Textos
  // -------------------------------------------------------------------------

  /** Globito de texto sobre un nadador. */
  private say(s: Swimmer, text: string, color: string): void {
    this.floatText(s.x, s.y - 12, text, color);
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.addText(x, y, text, { fontSize: '8px', fontStyle: '600', color, stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(9);
    // Que el globito quepa entero en la pantalla.
    t.setX(Math.round(Phaser.Math.Clamp(x, t.width / 2 + 3, BASE_WIDTH - t.width / 2 - 3)));
    this.floatTexts.push(t);
    this.tweens.add({
      targets: t,
      y: y - 10,
      alpha: 0,
      delay: 900,
      duration: 700,
      onComplete: () => {
        t.destroy();
        this.floatTexts = this.floatTexts.filter((o) => o !== t);
      },
    });
  }

  private banner(text: string, ms: number): void {
    this.bannerText.setText(text);
    const w = Math.min(280, this.bannerText.width + 20);
    const hh = this.bannerText.height + 12;
    this.bannerBg.clear();
    drawPanel(this.bannerBg, Math.round(BASE_WIDTH / 2 - w / 2), Math.round(92 - hh / 2), Math.round(w), Math.round(hh), { radius: 5 });
    this.bannerBg.setVisible(true);
    this.bannerText.setVisible(true);
    this.bannerMs = ms;
  }

  private hideBanner(): void {
    this.bannerBg.setVisible(false);
    this.bannerText.setVisible(false);
  }

  // -------------------------------------------------------------------------
  // Fin: el que es Marco cuando suena el silbato pierde
  // -------------------------------------------------------------------------

  private winner: PiscinaResult['winner'] = 'nadie';

  private end(first: string, quit = false): void {
    const youAreMarco = this.phase === 'marco_you' || this.phase === 'warmup' || (this.phase === 'swap' && this.next === 'you');
    this.winner = quit ? 'nadie' : youAreMarco ? 'grover' : 'you';
    this.phase = 'end';
    this.finished = true;
    const liters = (1.2 + Math.random() * 2).toFixed(1).replace('.', ',');
    const pucha = 8 + Math.floor(Math.random() * 12);
    const verdict =
      this.winner === 'you'
        ? '¡GANASTE! Grover era Marco cuando sonó el silbato.'
        : this.winner === 'grover'
          ? 'Ganó Grover: te tocó ser Marco cuando sonó el silbato.'
          : 'Ganador: nadie. Perdedor: nadie.';
    this.banner(
      `${first}\n\n${verdict}\nLo pillaste: ${this.tags} · Te pilló: ${this.caught}\nLitros de piscina que tragó Grover: ${liters} · «Pucha»: ${pucha}\n\n(E para salir del agua)`,
      999_999,
    );
  }

  private finish(): void {
    if (!this.finished) return;
    this.finished = false;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.done({ swam25: this.swam25, tags: this.tags, caught: this.caught, winner: this.winner }));
  }
}
