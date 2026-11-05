import Phaser from 'phaser';
import { playMusic, playSfx, setAmbient } from '../audio/sfx';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { parseClock } from '../systems/Mission';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

/**
 * Misión 6: la clase de natación con Sira, el jueves a las 7 en la piscina del GLD. Vista de lado, con la mitad
 * de abajo bajo el agua (se ven las piernas, las burbujas y el fondo con sus líneas).
 *
 * Cinco ejercicios, cada uno con su mecánica:
 *  1. Burbujas: mantén E para meter la cabeza y soltar el aire (tres tiempos), suelta para respirar (uno).
 *  2. La estrella: flotas de espaldas; A/D te equilibran. Sira te sostiene... y te suelta sin avisar.
 *  3. La patada: Sira te lleva de las manos; W y S alternados, al ritmo de su cuenta.
 *  4. El crol: E da la brazada; F respira de lado. «Uno, dos, tres, ¡aire!». 25 metros.
 *  5. La carrera: 25 metros contra Sira (que nada con un brazo, para darte ventaja).
 * Esc salta el ejercicio (no cuenta como aprendido).
 */

export interface NatacionResult {
  /** Ejercicios aprendidos (0..5). */
  lessons: number;
  /** Todos a la primera, sin tragar agua. */
  perfect: boolean;
  wonRace: boolean;
  /** Flotaste solo cuando Sira te soltó (la estrella completa). */
  held: boolean;
}

export interface NatacionSceneData {
  done: (r: NatacionResult) => void;
}

type Lesson = 'burbujas' | 'estrella' | 'patada' | 'crol' | 'carrera';
const LESSONS: Lesson[] = ['burbujas', 'estrella', 'patada', 'crol', 'carrera'];
const TITLES: Record<Lesson, string> = {
  burbujas: '1 · Burbujas',
  estrella: '2 · La estrella',
  patada: '3 · La patada',
  crol: '4 · El crol',
  carrera: '5 · La carrera',
};
const HINTS: Record<Lesson, string> = {
  burbujas: 'Mantén E: cabeza adentro y suelta el aire (3 tiempos) · Suelta E: respira (1)',
  estrella: 'A / D: equilíbrate · No dejes que la aguja salga de lo verde',
  patada: 'W y S alternados, al ritmo de la cuenta de Sira',
  crol: 'E: brazada · F: respirar de lado (cada 3 brazadas) · llega a la pared',
  carrera: 'E: brazada · F: respirar cada 3 · ¡gánale a Sira!',
};

const WATER_Y = 74;
const FLOOR_Y = 166;
const WALL_L = 14;
const WALL_R = 306;
/** 25 metros entre las dos paredes. */
const PX_PER_M = (WALL_R - WALL_L - 24) / 25;
const CLOCK_FROM = 'jue 19:05';
const CLOCK_TO = 'jue 19:55';

const BEAT = 0.6;
const BUBBLE_GOAL = 5;
const STAR_GOAL = 10;
const STAR_LET_GO = 4;
const KICK_GOAL = 12;
const STROKE_V = 34;
const BREATH_EVERY = 3;

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
}

interface FloatText {
  t: Phaser.GameObjects.Text;
  life: number;
}

export class NatacionScene extends BaseScene {
  private done!: (r: NatacionResult) => void;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private sayText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private meLook!: HumanLook;
  private siraLook!: HumanLook;
  private lessonIdx = 0;
  private lesson: Lesson = 'burbujas';
  private passed = 0;
  private clean = true;
  private wonRace = false;
  private held = false;
  private phase: 'intro' | 'play' | 'outro' | 'end' = 'intro';
  private phaseMs = 0;
  private t = 0;
  private bubbles: Bubble[] = [];
  private floats: FloatText[] = [];
  private sayMs = 0;
  private bannerMs = 0;
  private finished = false;

  // Estado de cada ejercicio.
  private under = false;
  private underT = 0;
  private upT = 0;
  private good = 0;
  private cough = 0;
  private tilt = 0;
  private tiltV = 0;
  private starT = 0;
  private outT = 0;
  private letGo = false;
  private kickBeat = 0;
  private lastKick: 'up' | 'down' | null = null;
  private kickDist = 0;
  private kickAnim = 0;
  private myX = 0;
  private myV = 0;
  private strokes = 0;
  private sinceBreath = 0;
  private arm = 0;
  private breathAnim = 0;
  private air = 1;
  private siraX = 0;
  private siraV = 0;
  private siraArm = 0;

  constructor() {
    super('Natacion');
    this.fixedCamera = true;
  }

  init(data: NatacionSceneData): void {
    this.done = data.done;
    this.lessonIdx = 0;
    this.passed = 0;
    this.clean = true;
    this.wonRace = false;
    this.held = false;
    this.finished = false;
    this.bubbles = [];
    this.floats = [];
    this.t = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101626');
    this.g = this.add.graphics();
    this.hud = this.add.graphics().setDepth(10);
    this.meLook = { ...playerLook(), shirt: playerLook().skin, pants: '#2f6fd0' };
    const sira = (characterLook('sira') as HumanLook | undefined) ?? this.meLook;
    this.siraLook = { ...sira, shirt: '#2c8c8c', pants: '#2c8c8c' };
    this.titleText = this.addText(6, 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f8e070' }).setDepth(11);
    this.hintText = this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 11, '', { fontSize: '8px', color: '#dfe6f4' }).setOrigin(0.5, 0).setDepth(11);
    this.sayText = this.addText(0, 0, '', {
      fontSize: '8px',
      color: '#2a2433',
      backgroundColor: '#fbf6ee',
      padding: { x: 3, y: 2 },
      wordWrap: { width: 150 },
    })
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setVisible(false);
    this.bannerBg = this.add.graphics().setDepth(13);
    this.bannerText = this.addText(BASE_WIDTH / 2, 92, '', { fontSize: '11px', fontStyle: '600', color: THEME.ink, align: 'center', wordWrap: { width: 250 } })
      .setOrigin(0.5)
      .setDepth(14);
    StoryState.setClock(parseClock(CLOCK_FROM), parseClock(CLOCK_TO));
    this.setupZoom();
    playMusic('natacion');
    setAmbient({ rain: 'none', indoor: false });
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.startLesson(0);
  }

  // -------------------------------------------------------------------------
  // Ejercicios
  // -------------------------------------------------------------------------

  private startLesson(i: number): void {
    this.lessonIdx = i;
    this.lesson = LESSONS[i];
    this.phase = 'intro';
    this.phaseMs = 0;
    this.under = false;
    this.underT = 0;
    this.upT = 0;
    this.good = 0;
    this.cough = 0;
    this.tilt = 0;
    this.tiltV = 0;
    this.starT = 0;
    this.outT = 0;
    this.letGo = false;
    this.kickBeat = 0;
    this.lastKick = null;
    this.kickDist = 0;
    this.myX = WALL_L + 14;
    this.myV = 0;
    this.strokes = 0;
    this.sinceBreath = 0;
    this.air = 1;
    this.siraX = WALL_L + 14;
    this.siraV = 0;
    this.titleText.setText(TITLES[this.lesson]);
    this.hintText.setText(HINTS[this.lesson]);
    const intro: Record<Lesson, string> = {
      burbujas: 'Sira: «Primero lo primero: aprender a soltar el aire debajo del agua. Como un suspiro, pero con burbujas.»',
      estrella: 'Sira: «Ahora la estrella: de espaldas, brazos abiertos, la panza arriba. Yo te sostengo. Confía.»',
      patada: 'Sira: «Dame las manos. Patea desde la cadera, no desde la rodilla. Yo camino para atrás.»',
      crol: 'Sira: «Ahora todo junto: brazada, brazada, brazada... y respiras de lado. Sin levantar la cabeza.»',
      carrera: 'Sira: «¿Una carrera? Te doy ventaja: yo nado con un solo brazo. El que pierde invita los helados.»',
    };
    this.banner(intro[this.lesson], 3600);
    StoryState.setClock(this.clockFor(i), parseClock(CLOCK_TO));
  }

  private clockFor(i: number): number {
    const a = parseClock(CLOCK_FROM);
    const b = parseClock(CLOCK_TO);
    return a + ((b - a) * i) / LESSONS.length;
  }

  private passLesson(text: string): void {
    if (this.phase !== 'play') return;
    this.passed++;
    playSfx('select');
    this.phase = 'outro';
    this.phaseMs = 0;
    this.banner(text, 3200);
  }

  private failLesson(text: string): void {
    if (this.phase !== 'play') return;
    this.clean = false;
    this.phase = 'outro';
    this.phaseMs = 0;
    this.banner(text, 3000);
  }

  private nextLesson(): void {
    if (this.lessonIdx + 1 < LESSONS.length) {
      this.startLesson(this.lessonIdx + 1);
      return;
    }
    this.phase = 'end';
    this.finished = true;
    StoryState.setClock(parseClock(CLOCK_TO), parseClock(CLOCK_TO));
    const verdict =
      this.passed >= 5
        ? 'Sira: «Mírate. El jueves pasado te ahogabas en 1,20 m.»\n(E para salir del agua)'
        : this.passed >= 3
          ? 'Sira: «Vas bien. Nadas como un pato... pero un pato que avanza.»\n(E para salir del agua)'
          : 'Sira: «Bueno, por lo menos ya no le tienes miedo al agua. Al agua le das miedo tú.»\n(E para salir del agua)';
    this.banner(verdict, 0);
  }

  private finish(): void {
    const result: NatacionResult = { lessons: this.passed, perfect: this.passed === 5 && this.clean, wonRace: this.wonRace, held: this.held };
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.done(result));
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    this.phaseMs += delta;
    if (this.bannerMs > 0) {
      this.bannerMs -= delta;
      if (this.bannerMs <= 0) this.hideBanner();
    }
    if (this.sayMs > 0) {
      this.sayMs -= delta;
      if (this.sayMs <= 0) this.sayText.setVisible(false);
    }
    if (this.finished) {
      if (Controls.consume('interact')) this.finish();
      this.render(dt);
      return;
    }
    if (this.phase === 'intro') {
      if (this.phaseMs > 3300 || Controls.consume('interact')) {
        this.hideBanner();
        this.phase = 'play';
        this.phaseMs = 0;
      }
      this.render(dt);
      return;
    }
    if (this.phase === 'outro') {
      if (this.phaseMs > 3000 || (this.phaseMs > 600 && Controls.consume('interact'))) this.nextLesson();
      this.render(dt);
      return;
    }
    if (Controls.consume('menu')) {
      this.failLesson('Sira: «¿Te lo saltas? Bueno... pero el jueves que viene lo repetimos.»');
      return;
    }
    if (this.lesson === 'burbujas') this.updateBubbles(dt);
    else if (this.lesson === 'estrella') this.updateStar(dt);
    else if (this.lesson === 'patada') this.updateKick(dt);
    else this.updateCrawl(dt, this.lesson === 'carrera');
    this.render(dt);
  }

  private updateBubbles(dt: number): void {
    const wants = Controls.isHeld('interact');
    if (this.cough > 0) {
      this.cough -= dt;
      return;
    }
    if (wants && !this.under) {
      this.under = true;
      this.underT = 0;
      if (this.upT > 0 && (this.upT < 0.25 || this.upT > 2.2) && this.good > 0) this.say('Sira: «¡Respira más tranquilo!»', 1400);
    } else if (!wants && this.under) {
      this.under = false;
      const d = this.underT;
      this.upT = 0;
      if (d >= 1.3 && d <= 2.6) {
        this.good++;
        playSfx('splash');
        this.float(`${this.good}/${BUBBLE_GOAL}`, '#a8f0a0');
        if (this.good === 2) this.say('Sira: «¡Eso! Uno, dos, tres... y arriba.»', 1600);
        if (this.good >= BUBBLE_GOAL) this.passLesson('¡Burbujas dominadas!\nSira: «Ves que el agua no muerde.»');
      } else if (d < 1.3) {
        this.float('¡Muy rápido!', '#ffd080');
      }
    }
    if (this.under) {
      this.underT += dt;
      if (Math.random() < dt * 14) this.bubbles.push({ x: 150 + Math.random() * 6, y: WATER_Y + 12, r: 1 + Math.random() * 2, vy: 30 + Math.random() * 20 });
      if (Math.random() < dt * 2) playSfx('burbujas');
      if (this.underT > 3.6) {
        this.under = false;
        this.cough = 1.2;
        this.clean = false;
        playSfx('chapuzon');
        this.float('¡Cof, cof!', '#ff9a9a');
        this.say('Sira: «¡Sal, sal! Las burbujas se sueltan, no se aguantan.»', 2200);
      }
    } else {
      this.upT += dt;
    }
    if (this.phaseMs > 60_000) this.failLesson('Sira: «Bueno, lo practicamos en la ducha. En serio.»');
  }

  private updateStar(dt: number): void {
    const elapsed = this.phaseMs / 1000;
    if (!this.letGo && this.starT >= STAR_LET_GO) {
      this.letGo = true;
      this.say('(Sira saca la mano sin decirte nada...)', 2200);
    }
    // El agua empuja para un lado y para el otro; Sira, mientras te sostiene, frena casi todo.
    const push = Math.sin(this.t * 1.3) * 0.9 + Math.sin(this.t * 3.1 + 1) * 0.5 + (Math.random() - 0.5) * 1.6;
    const hold = this.letGo ? 1 : 0.35;
    this.tiltV += push * hold * dt * 1.6;
    if (Controls.isHeld('left')) this.tiltV -= dt * 2.4;
    if (Controls.isHeld('right')) this.tiltV += dt * 2.4;
    this.tiltV *= 1 - dt * 1.8;
    this.tilt = Phaser.Math.Clamp(this.tilt + this.tiltV * dt, -1, 1);
    const inZone = Math.abs(this.tilt) < 0.38;
    if (inZone) {
      this.starT += dt;
      this.outT = 0;
    } else {
      this.outT += dt;
      if (this.outT > 1.6) {
        this.clean = false;
        playSfx('chapuzon');
        this.float('¡Glu, glu!', '#ff9a9a');
        this.say('Sira: «¡Te tengo! Otra vez, relaja el cuello.»', 1800);
        this.tilt = 0;
        this.tiltV = 0;
        this.outT = 0;
        this.starT = Math.max(0, this.starT - 3);
        this.letGo = this.starT >= STAR_LET_GO;
      }
    }
    if (this.starT >= STAR_GOAL) {
      this.held = true;
      this.passLesson('Sira: «¿Sabes hace cuánto te solté?»\n¡Flotaste solo!');
    } else if (elapsed > 70) {
      this.failLesson('Sira: «Bueno, la estrella es más difícil de lo que parece. Hasta para las estrellas.»');
    }
  }

  private updateKick(dt: number): void {
    this.kickBeat += dt;
    this.kickAnim = Math.max(0, this.kickAnim - dt * 3);
    let pressed: 'up' | 'down' | null = null;
    if (Controls.consume('up')) pressed = 'up';
    if (Controls.consume('down')) pressed = 'down';
    if (pressed) {
      const phase = (this.kickBeat % BEAT) / BEAT;
      const onBeat = phase < 0.35 || phase > 0.75;
      if (pressed !== this.lastKick && onBeat) {
        this.kickDist += 0.6;
        this.kickAnim = 1;
        playSfx('splash');
        if (Math.random() < 0.25) this.float('¡Bien!', '#a8f0a0');
      } else if (pressed === this.lastKick) {
        this.kickDist = Math.max(0, this.kickDist - 0.2);
        this.float('¡Alterna!', '#ffd080');
      } else {
        this.kickDist += 0.25;
        this.kickAnim = 0.6;
        this.float('¡Al ritmo!', '#ffd080');
      }
      this.lastKick = pressed;
    }
    // Sira camina para atrás llevándote de las manos.
    this.myX = WALL_L + 40 + this.kickDist * PX_PER_M;
    if (this.kickDist > 5 && this.kickDist < 5.6) this.say('Sira: «¡Me estás mojando entera! ...Sigue, sigue.»', 1600);
    if (this.kickDist > 9 && this.kickDist < 9.6) this.say('(Están muy cerca. Ella te mira y se ríe.)', 1600);
    if (this.kickDist >= KICK_GOAL) this.passLesson('¡Doce metros pateando!\nSira: «Ya te puedo soltar las manos. ...Si quiero.»');
    else if (this.phaseMs > 50_000) this.failLesson('Sira: «Mucha rodilla y poca cadera. Pero vas.»');
  }

  private updateCrawl(dt: number, race: boolean): void {
    this.arm = Math.max(0, this.arm - dt * 3);
    this.breathAnim = Math.max(0, this.breathAnim - dt * 2);
    if (this.cough > 0) this.cough -= dt;
    if (Controls.consume('interact') && this.cough <= 0) {
      if (this.air <= 0.05) {
        this.float('¡Sin aire!', '#ff9a9a');
      } else {
        this.myV += STROKE_V * (this.sinceBreath <= BREATH_EVERY ? 1 : 0.6);
        this.strokes++;
        this.sinceBreath++;
        this.arm = 1;
        this.air = Math.max(0, this.air - 0.12);
        playSfx('splash');
        if (this.sinceBreath === BREATH_EVERY) this.say('«¡Aire!»', 700);
      }
    }
    if (Controls.consume('trick')) {
      if (this.sinceBreath >= BREATH_EVERY - 1) {
        this.air = 1;
        this.sinceBreath = 0;
        this.breathAnim = 1;
        playSfx('burbujas');
        this.float('aire', '#a8e0ff');
      } else {
        // Respirar a destiempo: la cabeza afuera muy pronto y entra agua.
        this.cough = 0.9;
        this.clean = false;
        this.myV *= 0.4;
        playSfx('chapuzon');
        this.float('¡Tragaste agua!', '#ff9a9a');
      }
    }
    if (this.sinceBreath > BREATH_EVERY + 1) this.air = Math.max(0, this.air - dt * 0.25);
    this.myV *= 1 - dt * 1.6;
    if (Controls.isHeld('up') || Controls.isHeld('down')) this.myV += dt * 6;
    this.myX = Math.min(WALL_R - 14, this.myX + this.myV * dt);
    if (race) {
      // Sira nada a ritmo parejo (con un brazo), un poco más lento que un crol bien hecho.
      this.siraArm += dt * 2.2;
      this.siraV = 20 + Math.sin(this.t * 2.2) * 3;
      this.siraX = Math.min(WALL_R - 14, this.siraX + this.siraV * dt);
      if (this.siraX >= WALL_R - 14 && this.myX < WALL_R - 14) {
        this.failLesson('Sira toca la pared primero.\nSira: «Con un brazo. Me debes un helado.»');
        return;
      }
    }
    if (this.myX >= WALL_R - 14) {
      if (race) {
        this.wonRace = true;
        this.passLesson('¡Tocaste la pared primero!\nSira: «...Te dejé ganar. (No te dejó ganar.)»');
      } else {
        this.passLesson('¡25 metros de crol!\nSira: «Eso fue nadar. Nadar de verdad.»');
      }
    } else if (this.phaseMs > (race ? 45_000 : 70_000)) {
      this.failLesson('Sira: «Uy, se nos acabó la hora. Lo terminamos el otro jueves.»');
    }
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private render(dt: number): void {
    const g = this.g;
    g.clear();
    this.drawPool(g);
    const wob = Math.sin(this.t * 2) * 1;
    if (this.lesson === 'burbujas') {
      const headY = this.under ? WATER_Y + 10 : WATER_Y - 6;
      this.drawStanding(g, 150, headY, this.meLook, this.under);
      this.drawStanding(g, 186, WATER_Y - 8 + wob, this.siraLook, false, true);
    } else if (this.lesson === 'estrella') {
      const sink = this.outT * 6;
      this.drawFloating(g, 150, WATER_Y + sink, this.meLook, this.tilt);
      this.drawStanding(g, 196, WATER_Y - 8 + wob, this.siraLook, false, true);
      if (!this.letGo) {
        // La mano de Sira bajo tu espalda.
        g.fillStyle(0xf8e2d4, 1).fillRect(152, WATER_Y + 4, 12, 3);
      }
    } else if (this.lesson === 'patada') {
      this.drawSwimmer(g, this.myX, WATER_Y + 2, this.meLook, 1, this.t * (this.kickAnim > 0 ? 18 : 3), 0, 0);
      this.drawStanding(g, this.myX + 34, WATER_Y - 8 + wob, this.siraLook, false, true);
      g.fillStyle(0xf8e2d4, 1).fillRect(this.myX + 12, WATER_Y, 14, 2);
      if (this.kickAnim > 0.3) for (let i = 0; i < 2; i++) this.bubbles.push({ x: this.myX - 18, y: WATER_Y + 6, r: 1.5, vy: 20 });
    } else {
      const head = this.breathAnim > 0.2 ? 1 : 0;
      this.drawSwimmer(g, this.myX, WATER_Y + 2, this.meLook, 1, this.t * 10, this.arm, head);
      if (this.lesson === 'carrera') this.drawSwimmer(g, this.siraX, WATER_Y + 30, this.siraLook, 1, this.t * 11, (Math.sin(this.siraArm * 3) + 1) / 2, 0, true);
      else this.drawStanding(g, WALL_R - 22, WATER_Y - 8 + wob, this.siraLook, false, true);
      if (this.arm > 0.6) this.bubbles.push({ x: this.myX + 6, y: WATER_Y + 8, r: 1.5, vy: 26 });
    }
    // El agua por encima de lo sumergido (los cuerpos se ven azulados bajo la superficie).
    g.fillStyle(0x2e94d0, 0.42).fillRect(WALL_L, WATER_Y, WALL_R - WALL_L, FLOOR_Y - WATER_Y);
    g.fillStyle(0xb8ecff, 0.9);
    for (let x = WALL_L; x < WALL_R; x += 4) g.fillRect(x, WATER_Y - 1 + Math.round(Math.sin(this.t * 3 + x * 0.15)), 3, 1);
    // Burbujas.
    for (const b of this.bubbles) {
      b.y -= b.vy * dt;
      b.x += Math.sin(this.t * 6 + b.y) * 0.2;
    }
    this.bubbles = this.bubbles.filter((b) => b.y > WATER_Y + 1).slice(-80);
    for (const b of this.bubbles) g.lineStyle(1, 0xd8f4ff, 0.9).strokeCircle(b.x, b.y, b.r);
    // Textos flotantes.
    for (const f of this.floats) {
      f.life -= dt;
      f.t.setY(f.t.y - dt * 14).setAlpha(Math.min(1, f.life * 2));
    }
    for (const f of this.floats.filter((x) => x.life <= 0)) f.t.destroy();
    this.floats = this.floats.filter((f) => f.life > 0);
    this.drawHud();
  }

  private drawPool(g: Phaser.GameObjects.Graphics): void {
    // Techo del coliseo y sus luces.
    g.fillStyle(0x141a2c, 1).fillRect(0, 0, BASE_WIDTH, WATER_Y);
    for (let x = 30; x < BASE_WIDTH; x += 70) {
      g.fillStyle(0xfff6c8, 1).fillRect(x, 16, 14, 3);
      g.fillStyle(0xfff6c8, 0.06).fillTriangle(x - 10, 19, x + 24, 19, x + 7, WATER_Y);
    }
    // Las gradas al fondo con su gente borrosa.
    g.fillStyle(0x2a3046, 1).fillRect(0, 38, BASE_WIDTH, 22);
    for (let x = 6; x < BASE_WIDTH; x += 11) g.fillStyle([0xe86078, 0x5a8ad8, 0xf0c040, 0x48a868][(x / 11) % 4 | 0], 0.6).fillRect(x, 44 + ((x / 11) % 2) * 6, 5, 6);
    g.fillStyle(0xd8d4c8, 1).fillRect(0, 60, BASE_WIDTH, 8);
    g.fillStyle(0xb8b2a4, 1).fillRect(0, 66, BASE_WIDTH, 2);
    // El agua: de celeste a azul profundo, con reflejos que se mueven.
    const bands = [0x4ab4e8, 0x3ca4dc, 0x2e94d0, 0x2484c4, 0x1c74b4, 0x1868a8];
    const bh = (FLOOR_Y - WATER_Y) / bands.length;
    bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, WATER_Y + i * bh, BASE_WIDTH, bh + 1));
    for (let i = 0; i < 14; i++) {
      const x = (i * 37 + this.t * 18) % (BASE_WIDTH + 20) - 10;
      const y = WATER_Y + 8 + ((i * 23) % 70);
      g.fillStyle(0xb8ecff, 0.18).fillRect(x, y, 14, 1);
    }
    // Superficie con olitas.
    g.fillStyle(0xb8ecff, 0.9);
    for (let x = 0; x < BASE_WIDTH; x += 4) g.fillRect(x, WATER_Y - 1 + Math.round(Math.sin(this.t * 3 + x * 0.15)), 3, 1);
    // Fondo con su línea negra y las baldosas.
    g.fillStyle(0xe8eef0, 1).fillRect(0, FLOOR_Y, BASE_WIDTH, BASE_HEIGHT - FLOOR_Y);
    for (let x = 0; x < BASE_WIDTH; x += 8) g.fillStyle(0xc8d4d8, 1).fillRect(x, FLOOR_Y, 1, BASE_HEIGHT - FLOOR_Y);
    g.fillStyle(0x123c78, 1).fillRect(WALL_L + 10, FLOOR_Y + 3, WALL_R - WALL_L - 20, 3);
    // Paredes de la piscina (los 25 metros).
    g.fillStyle(0xf4f2ea, 1).fillRect(0, 60, WALL_L, BASE_HEIGHT - 60).fillRect(WALL_R, 60, BASE_WIDTH - WALL_R, BASE_HEIGHT - 60);
    g.fillStyle(0x123c78, 1).fillRect(WALL_L - 2, WATER_Y + 4, 2, 60).fillRect(WALL_R, WATER_Y + 4, 2, 60);
    // Metros marcados en el fondo.
    for (let m = 5; m < 25; m += 5) {
      const x = WALL_L + 12 + m * PX_PER_M;
      g.fillStyle(0x123c78, 0.6).fillRect(x, FLOOR_Y - 4, 1, 4);
    }
  }

  /** De pie en el agua hasta el pecho (o con la cabeza adentro). */
  private drawStanding(g: Phaser.GameObjects.Graphics, x: number, headY: number, look: HumanLook, under: boolean, cap = false): void {
    const hc = Phaser.Display.Color.HexStringToColor;
    const skin = hc(look.skin).color;
    // Cuerpo (el agua translúcida se dibuja encima después): torso con el traje de baño, piernas y brazos.
    const suit = hc(look.shirt === look.skin ? look.pants : look.shirt).color;
    g.fillStyle(0x2a2433, 1).fillRect(x - 6, headY + 6, 12, 42);
    g.fillStyle(skin, 1).fillRect(x - 5, headY + 7, 10, 22);
    g.fillStyle(suit, 1).fillRect(x - 5, look.shirt === look.skin ? headY + 22 : headY + 12, 10, look.shirt === look.skin ? 7 : 17);
    g.fillStyle(skin, 1).fillRect(x - 5, headY + 29, 4, 18).fillRect(x + 1, headY + 29, 4, 18);
    g.fillStyle(skin, 1).fillRect(x - 8, headY + 9, 3, 14).fillRect(x + 5, headY + 9, 3, 14);
    // Cabeza.
    g.fillStyle(0x2a2433, 1).fillRect(x - 5, headY - 6, 10, 12);
    g.fillStyle(skin, 1).fillRect(x - 4, headY - 5, 8, 10);
    g.fillStyle(cap ? 0x2c8c8c : hc(look.hair).color, 1).fillRect(x - 5, headY - 7, 10, 4);
    if (under) {
      g.fillStyle(0x202028, 1).fillRect(x - 2, headY - 1, 1, 1).fillRect(x + 2, headY - 1, 1, 1);
      g.fillStyle(0x7a2a2a, 1).fillRect(x - 1, headY + 2, 2, 2);
    } else {
      g.fillStyle(0x202028, 1).fillRect(x - 2, headY - 1, 1, 2).fillRect(x + 2, headY - 1, 1, 2);
      g.fillStyle(0xe8a0a0, 1).fillRect(x - 3, headY + 2, 1, 1).fillRect(x + 3, headY + 2, 1, 1);
    }
  }

  /** Flotando de espaldas, inclinado según `tilt` (-1..1). */
  private drawFloating(g: Phaser.GameObjects.Graphics, x: number, y: number, look: HumanLook, tilt: number): void {
    const hc = Phaser.Display.Color.HexStringToColor;
    const skin = hc(look.skin).color;
    const d = Math.round(tilt * 6);
    g.fillStyle(skin, 0.9).fillRect(x - 18, y - 2 - d, 14, 5).fillRect(x - 4, y - 2, 12, 5).fillRect(x + 8, y - 2 + d, 12, 4);
    g.fillStyle(hc(look.pants).color, 1).fillRect(x - 4, y - 2, 8, 5);
    // Brazos abiertos (la estrella).
    g.fillStyle(skin, 0.85).fillRect(x - 12, y - 8 - d, 2, 6).fillRect(x - 12, y + 3 - d, 2, 6);
    g.fillStyle(0x2a2433, 1).fillRect(x - 26, y - 6 - d, 9, 9);
    g.fillStyle(skin, 1).fillRect(x - 25, y - 5 - d, 7, 7);
    g.fillStyle(hc(look.hair).color, 1).fillRect(x - 27, y - 5 - d, 3, 7);
    g.fillStyle(0x202028, 1).fillRect(x - 22, y - 4 - d, 1, 1);
  }

  /** Nadando boca abajo hacia la derecha: piernas que patean, brazos que dan la brazada. */
  private drawSwimmer(g: Phaser.GameObjects.Graphics, x: number, y: number, look: HumanLook, _dir: number, kickT: number, arm: number, head: number, cap = false): void {
    const hc = Phaser.Display.Color.HexStringToColor;
    const skin = hc(look.skin).color;
    const k = Math.sin(kickT) * 3;
    g.fillStyle(skin, 0.85).fillRect(x - 26, y - 1 + k, 12, 3).fillRect(x - 26, y + 2 - k, 12, 3);
    g.fillStyle(hc(look.pants).color, 1).fillRect(x - 14, y - 2, 8, 6);
    g.fillStyle(skin, 0.95).fillRect(x - 6, y - 2, 12, 6);
    // Brazo: adelante (estirado) o en el aire (recobro).
    if (arm > 0.4) g.fillStyle(skin, 1).fillRect(x, y - 10, 3, 9).fillRect(x + 3, y - 12, 6, 3);
    else g.fillStyle(skin, 0.85).fillRect(x + 6, y - 1, 12, 3);
    const hy = head > 0 ? y - 7 : y - 3;
    g.fillStyle(0x2a2433, 1).fillRect(x + 5, hy - 1, 9, 9);
    g.fillStyle(skin, 1).fillRect(x + 6, hy, 7, 7);
    g.fillStyle(cap ? 0x2c8c8c : hc(look.hair).color, 1).fillRect(x + 6, hy - 1, 7, 3);
    g.fillStyle(0x202028, 1).fillRect(x + 10, hy + 3, 1, 1);
    if (head > 0) g.fillStyle(0x7a2a2a, 1).fillRect(x + 11, hy + 5, 2, 1);
    // Espuma.
    g.fillStyle(0xffffff, 0.8).fillRect(x - 30 + Math.round(k), y - 3, 4, 1).fillRect(x - 28, y + 5, 3, 1);
  }

  private drawHud(): void {
    const h = this.hud;
    h.clear();
    h.fillStyle(0x0c1020, 0.75).fillRect(0, 0, BASE_WIDTH, 15);
    h.fillStyle(0x0c1020, 0.75).fillRect(0, BASE_HEIGHT - 13, BASE_WIDTH, 13);
    // Estrellitas de los ejercicios aprendidos.
    for (let i = 0; i < 5; i++) {
      const c = i < this.passed ? 0xf8e070 : 0x3a4060;
      const x = BASE_WIDTH - 60 + i * 11;
      h.fillStyle(c, 1).fillRect(x + 3, 3, 3, 9).fillRect(x, 6, 9, 3);
    }
    if (this.phase !== 'play') return;
    if (this.lesson === 'burbujas') {
      // La cuenta de Sira: tres tiempos adentro, uno afuera.
      const beats = this.under ? Math.min(4, Math.floor(this.underT / BEAT) + 1) : 0;
      for (let i = 0; i < 4; i++) {
        const on = this.under && i < beats && i < 3;
        h.fillStyle(i < 3 ? (on ? 0x58c8f0 : 0x2a3a58) : this.under ? 0x2a3a58 : 0xa8f0a0, 1).fillRoundedRect(110 + i * 26, 20, 22, 8, 3);
      }
      this.bar(h, 110, 32, 100, this.good / BUBBLE_GOAL, 0x8ae08a);
    } else if (this.lesson === 'estrella') {
      h.fillStyle(0x2a3a58, 1).fillRoundedRect(100, 20, 120, 10, 4);
      h.fillStyle(0x58c070, 1).fillRect(160 - 23, 21, 46, 8);
      h.fillStyle(0xf8e070, 1).fillRect(160 + this.tilt * 58 - 1, 18, 3, 14);
      this.bar(h, 110, 34, 100, this.starT / STAR_GOAL, 0x8ae08a);
    } else if (this.lesson === 'patada') {
      const phase = (this.kickBeat % BEAT) / BEAT;
      const next = this.lastKick === 'up' ? 'S' : 'W';
      h.fillStyle(phase < 0.35 || phase > 0.75 ? 0xa8f0a0 : 0x2a3a58, 1).fillCircle(160, 26, 6);
      this.bar(h, 110, 36, 100, this.kickDist / KICK_GOAL, 0x8ae08a);
      this.sayHint(`próxima: ${next}`);
    } else {
      // Aire y brazadas desde la última respiración.
      this.bar(h, 60, 20, 80, this.air, this.air < 0.3 ? 0xff7a7a : 0x58c8f0);
      for (let i = 0; i < BREATH_EVERY; i++) h.fillStyle(i < this.sinceBreath ? 0xf8e070 : 0x2a3a58, 1).fillCircle(160 + i * 10, 24, 3);
      h.fillStyle(this.sinceBreath >= BREATH_EVERY ? 0xa8f0a0 : 0x2a3a58, 1).fillCircle(160 + BREATH_EVERY * 10, 24, 4);
      const meters = Math.round((this.myX - WALL_L - 14) / PX_PER_M);
      this.sayHint(`${Math.max(0, Math.min(25, meters))} m`);
    }
  }

  private hintCache = '';

  private sayHint(s: string): void {
    if (s === this.hintCache) return;
    this.hintCache = s;
    this.titleText.setText(`${TITLES[this.lesson]}   ${s}`);
  }

  private bar(h: Phaser.GameObjects.Graphics, x: number, y: number, w: number, v: number, color: number): void {
    h.fillStyle(0x2a3a58, 1).fillRoundedRect(x, y, w, 5, 2);
    h.fillStyle(color, 1).fillRoundedRect(x, y, Math.max(2, w * Phaser.Math.Clamp(v, 0, 1)), 5, 2);
  }

  private say(text: string, ms: number): void {
    const x = this.lesson === 'carrera' ? 160 : this.lesson === 'patada' ? Math.min(250, this.myX + 34) : 190;
    this.sayText.setText(text).setPosition(Math.round(x), WATER_Y - 22).setVisible(true);
    this.sayMs = ms;
  }

  private float(text: string, color: string): void {
    const x = this.lesson === 'burbujas' || this.lesson === 'estrella' ? 150 : this.myX;
    const t = this.addText(Math.round(x), WATER_Y - 30, text, { fontSize: '9px', fontStyle: '600', color, stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(12);
    this.floats.push({ t, life: 1.1 });
  }

  private banner(text: string, ms: number): void {
    this.bannerText.setText(text).setVisible(true);
    const b = this.bannerText.getBounds();
    this.bannerBg.clear().fillStyle(0xfbf6ee, 0.96).fillRoundedRect(b.x - 8, b.y - 6, b.width + 16, b.height + 12, 6).setVisible(true);
    this.bannerBg.lineStyle(1, 0x2a2433, 1).strokeRoundedRect(b.x - 8, b.y - 6, b.width + 16, b.height + 12, 6);
    this.bannerMs = ms;
  }

  private hideBanner(): void {
    this.bannerText.setVisible(false);
    this.bannerBg.setVisible(false);
  }
}
