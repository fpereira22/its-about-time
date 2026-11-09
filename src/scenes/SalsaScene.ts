import Phaser from 'phaser';
import { playMusic, playSfx, setAmbient } from '../audio/sfx';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import { drawSideArm, drawSideBody, type SideFigureOpts } from '../art/vinetas';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { playerLook } from '../systems/PlayerLook';
import { THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

/**
 * Misión 7: Sira te enseña a bailar salsa en el depa del piso 8, con la lluvia en el ventanal.
 * Vista de lado de la sala. Los pasos llegan por la cinta de arriba al ritmo del «uno, dos, tres... cinco, seis, siete»:
 *  1. Lo básico: A y D, pie izquierdo y pie derecho.
 *  2. La vuelta: además, E hace girar a Sira en el 5.
 *  3. Pegaditos: lo mismo, más rápido (y ella bien cerca).
 * Cada paso se aprieta cuando llega a la marca. Esc salta la ronda (no cuenta como bien hecha).
 */

export interface SalsaResult {
  /** Rondas bien bailadas. */
  score: number;
  total: number;
  perfect: boolean;
  /** Pasos acertados y pasos en total. */
  hits: number;
  notes: number;
}

export interface SalsaSceneData {
  done: (r: SalsaResult) => void;
}

type Step = 'left' | 'right' | 'interact';
interface Note {
  beat: number;
  key: Step;
  state: 'wait' | 'hit' | 'miss';
}
interface Round {
  title: string;
  intro: string;
  hint: string;
  beatMs: number;
  build: () => Array<[number, Step]>;
}

const BARS = 4;
/** Los pasos de un compás de 8: 1-2-3 y 5-6-7 (el 4 y el 8 se descansan). */
const BASIC: Array<[number, Step]> = [[0, 'left'], [1, 'right'], [2, 'left'], [4, 'right'], [5, 'left'], [6, 'right']];
const TURN: Array<[number, Step]> = [[0, 'left'], [1, 'right'], [2, 'left'], [4, 'interact'], [5, 'left'], [6, 'right']];

const repeat = (bar: Array<[number, Step]>): Array<[number, Step]> =>
  Array.from({ length: BARS }, (_, b) => bar.map(([beat, key]): [number, Step] => [beat + b * 8, key])).flat();

const ROUNDS: Round[] = [
  {
    title: 'Lo básico',
    intro: 'Sira: «Uno, dos, tres... cinco, seis, siete. El cuatro se descansa. Es Cali, chileno: aquí todo se descansa.»\nA: pie izquierdo · D: pie derecho',
    hint: 'A / D cuando el paso llegue a la marca · Esc: saltar',
    beatMs: 620,
    build: () => repeat(BASIC),
  },
  {
    title: 'La vuelta',
    intro: 'Sira: «Ahora me haces girar. En el cinco, sube el brazo. El brazo. EL OTRO BRAZO.»\nA / D: pasos · E: hacerla girar',
    hint: 'A / D: pasos · E: la vuelta en el 5 · Esc: saltar',
    beatMs: 560,
    build: () => repeat(TURN),
  },
  {
    title: 'Pegaditos',
    intro: 'Sira: «Y la última es pegadito. Más rápido. Y no mires los pies, mírame a mí.»\nA / D: pasos · E: la vuelta',
    hint: 'No mires los pies · Esc: saltar',
    beatMs: 480,
    build: () => repeat(TURN),
  },
];

const LANE_Y = 34;
const TARGET_X = 56;
/** Pixeles por tiempo: un pulso ocupa este ancho en la cinta. */
const PX_PER_BEAT = 34;
const PERFECT_MS = 90;
const OK_MS = 170;
const PASS_RATE = 0.7;
const FLOOR_Y = 138;

const KEY_LABEL: Record<Step, string> = { left: 'A', right: 'D', interact: 'E' };
const KEY_COLOR: Record<Step, number> = { left: 0x4a9ad8, right: 0xe8903c, interact: 0xe8607a };
const COUNTS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const MISS_LINES = ['¡Me pisaste!', '¡El cuatro se descansa!', 'Uno, dos, tres...', '¡Ay, mi pie!', 'Mírame a mí, no al piso'];
const HIT_LINES = ['¡Eso!', '¡Así, chileno!', '¡Ahí está!', 'Ya casi eres caleño'];

interface FloatText {
  t: Phaser.GameObjects.Text;
  life: number;
}

export class SalsaScene extends BaseScene {
  private done!: (r: SalsaResult) => void;
  private roundIdx = 0;
  private phase: 'intro' | 'play' | 'outro' | 'end' = 'intro';
  private phaseMs = 0;
  /** Milisegundos desde que partió la ronda (con un compás de cuenta antes). */
  private clock = 0;
  private notes: Note[] = [];
  private score = 0;
  private roundHits = 0;
  private hits = 0;
  private total = 0;
  private streak = 0;
  private lastBeat = -1;
  private stepSide = 0;
  private spin = 0;
  private closeness = 0;
  private floats: FloatText[] = [];
  private sayMs = 0;
  private rain: Array<{ x: number; y: number }> = [];
  private leaving = false;

  private bg!: Phaser.GameObjects.Graphics;
  private figs!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private sayText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private noteLabels: Phaser.GameObjects.Text[] = [];
  private meLook!: HumanLook;
  private siraLook!: HumanLook;

  constructor() {
    super('Salsa');
    this.fixedCamera = true;
  }

  init(data: SalsaSceneData): void {
    this.done = data.done;
    this.roundIdx = 0;
    this.score = 0;
    this.hits = 0;
    this.total = 0;
    this.floats = [];
    this.noteLabels = [];
    this.closeness = 0;
    this.leaving = false;
    this.rain = Array.from({ length: 34 }, (_, i) => ({ x: 34 + ((i * 37) % 112), y: 28 + ((i * 53) % 72) }));
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1c1820');
    this.bg = this.add.graphics();
    this.figs = this.add.graphics().setDepth(2);
    this.hud = this.add.graphics().setDepth(10);
    this.meLook = playerLook();
    this.siraLook = (characterLook('sira_m7_polera') as HumanLook | undefined) ?? this.meLook;
    this.titleText = this.addText(6, 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f8e070' }).setDepth(11);
    this.hintText = this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 11, '', { fontSize: '8px', color: '#dfe6f4' }).setOrigin(0.5, 0).setDepth(11);
    this.countText = this.addText(TARGET_X, LANE_Y + 16, '', { fontSize: '10px', fontStyle: '600', color: '#fbf6ee', stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5, 0)
      .setDepth(11);
    this.sayText = this.addText(0, 0, '', { fontSize: '8px', color: '#2a2433', backgroundColor: '#fbf6ee', padding: { x: 3, y: 2 }, wordWrap: { width: 130 } })
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setVisible(false);
    this.bannerBg = this.add.graphics().setDepth(13);
    this.bannerText = this.addText(BASE_WIDTH / 2, 88, '', { fontSize: '10px', fontStyle: '600', color: THEME.ink, align: 'center', wordWrap: { width: 270 } })
      .setOrigin(0.5)
      .setDepth(14);
    this.drawRoom();
    this.setupZoom();
    playMusic('salsa');
    setAmbient({ rain: 'none', indoor: true });
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.startRound(0);
  }

  // -------------------------------------------------------------------------
  // Rondas
  // -------------------------------------------------------------------------

  private get round(): Round {
    return ROUNDS[this.roundIdx];
  }

  private startRound(i: number): void {
    this.roundIdx = i;
    this.phase = 'intro';
    this.phaseMs = 0;
    this.clock = -this.round.beatMs * 8;
    this.lastBeat = -99;
    this.roundHits = 0;
    this.streak = 0;
    this.notes = this.round.build().map(([beat, key]) => ({ beat, key, state: 'wait' }));
    this.titleText.setText(`Ronda ${i + 1}/${ROUNDS.length} · ${this.round.title}`);
    this.hintText.setText(this.round.hint);
    this.countText.setText('');
    this.banner(`${this.round.intro}\n(E para empezar)`);
    for (const l of this.noteLabels) l.destroy();
    this.noteLabels = this.notes.map((n) =>
      this.addText(0, LANE_Y, KEY_LABEL[n.key], { fontSize: '8px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5).setDepth(11).setVisible(false),
    );
  }

  private finishRound(ok: boolean, verdict: string): void {
    if (this.phase !== 'play') return;
    if (ok) this.score++;
    this.phase = 'outro';
    this.phaseMs = 0;
    this.closeness = Math.min(1, this.closeness + (ok ? 0.4 : 0.15));
    this.countText.setText('');
    for (const l of this.noteLabels) l.setVisible(false);
    this.banner(`${verdict}\n(E para seguir)`);
    playSfx(ok ? 'item' : 'error');
  }

  private nextRound(): void {
    this.hideBanner();
    if (this.roundIdx + 1 < ROUNDS.length) {
      this.startRound(this.roundIdx + 1);
      return;
    }
    this.phase = 'end';
    const verdict =
      this.score === ROUNDS.length
        ? 'Sira: «¿Y tú me dijiste que no sabías bailar? ...Mentiroso. Lindo, pero mentiroso.»'
        : this.score >= 1
          ? 'Sira: «Bueno. Ya no eres un peligro público. Eres un peligro de barrio.»'
          : 'Sira: «Me pisaste once veces. Las conté. Igual no quiero parar.»';
    this.banner(`${verdict}\n(E para seguir)`);
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    const result: SalsaResult = { score: this.score, total: ROUNDS.length, perfect: this.score === ROUNDS.length, hits: this.hits, notes: this.total };
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.done(result));
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    this.phaseMs += delta;
    if (this.sayMs > 0) {
      this.sayMs -= delta;
      if (this.sayMs <= 0) this.sayText.setVisible(false);
    }
    this.spin = Math.max(0, this.spin - dt / 420);
    this.floats = this.floats.filter((f) => {
      f.life -= dt / 1000;
      f.t.y -= dt * 0.02;
      f.t.setAlpha(Math.min(1, f.life * 2));
      if (f.life > 0) return true;
      f.t.destroy();
      return false;
    });

    if (this.phase === 'intro' && this.phaseMs > 250 && Controls.consume('interact')) {
      this.hideBanner();
      this.phase = 'play';
      this.phaseMs = 0;
    } else if (this.phase === 'play') {
      this.clock += dt;
      this.play();
    } else if (this.phase === 'outro' && this.phaseMs > 500 && Controls.consume('interact')) {
      this.nextRound();
    } else if (this.phase === 'end' && Controls.consume('interact')) {
      this.finish();
    }
    this.drawScene();
  }

  private play(): void {
    if (Controls.consume('menu')) {
      this.finishRound(false, 'Sira: «¿Te rendiste? Bueno, esa la bailo sola.»');
      return;
    }
    const beatMs = this.round.beatMs;
    const beatNow = Math.floor(this.clock / beatMs);
    if (beatNow !== this.lastBeat) {
      this.lastBeat = beatNow;
      if (beatNow < 0) this.countText.setText(COUNTS[(beatNow + 8) % 8]);
      else this.countText.setText(COUNTS[beatNow % 8]);
      playSfx('click');
    }

    for (const key of ['left', 'right', 'interact'] as const) {
      if (Controls.consume(key)) this.press(key);
    }
    for (const n of this.notes) {
      if (n.state === 'wait' && this.clock - n.beat * beatMs > OK_MS) this.judgeMiss(n);
    }
    const last = this.notes[this.notes.length - 1];
    if (this.clock > (last.beat + 2) * beatMs) {
      const rate = this.roundHits / this.notes.length;
      const ok = rate >= PASS_RATE;
      const pct = Math.round(rate * 100);
      this.finishRound(ok, ok ? `Sira: «¡Eso, chileno!» (${pct}% de los pasos)` : `Sira: «Me pisaste, pero con cariño.» (${pct}% de los pasos)`);
    }
  }

  private press(key: Step): void {
    const beatMs = this.round.beatMs;
    let best: Note | null = null;
    let bestD = Infinity;
    for (const n of this.notes) {
      if (n.state !== 'wait') continue;
      const d = Math.abs(this.clock - n.beat * beatMs);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    if (!best || bestD > OK_MS * 1.6) return;
    if (best.key !== key || bestD > OK_MS) {
      this.judgeMiss(best);
      return;
    }
    best.state = 'hit';
    this.hits++;
    this.total++;
    this.roundHits++;
    this.streak++;
    this.stepSide = key === 'left' ? -1 : key === 'right' ? 1 : this.stepSide;
    if (key === 'interact') {
      this.spin = 1;
      playSfx('salto');
    } else playSfx('blip');
    const perfect = bestD <= PERFECT_MS;
    this.float(perfect ? '¡Perfecto!' : 'Bien', perfect ? '#f8e070' : '#a8e0a0', TARGET_X + 40, LANE_Y + 20);
    if (this.streak > 0 && this.streak % 8 === 0) this.say(HIT_LINES[Math.floor(this.streak / 8 - 1) % HIT_LINES.length], 900);
  }

  private judgeMiss(n: Note): void {
    n.state = 'miss';
    this.total++;
    this.streak = 0;
    this.float('¡Ups!', '#ff9c9c', TARGET_X + 40, LANE_Y + 20);
    if (Math.random() < 0.45) {
      playSfx('golpe');
      this.say(MISS_LINES[Math.floor(Math.random() * MISS_LINES.length)], 800);
    }
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  /** La sala: pared, ventanal con la llovizna, el póster, la tele apagada y la alfombra. */
  private drawRoom(): void {
    const g = this.bg;
    g.fillStyle(0xe8e0d0, 1).fillRect(0, 0, BASE_WIDTH, FLOOR_Y);
    g.fillStyle(0xc89c6c, 1).fillRect(0, FLOOR_Y, BASE_WIDTH, BASE_HEIGHT - FLOOR_Y);
    for (let x = 0; x < BASE_WIDTH; x += 24) g.fillStyle(0xb88c5c, 1).fillRect(x, FLOOR_Y, 1, BASE_HEIGHT - FLOOR_Y);
    g.fillStyle(0x7c9cd4, 1).fillEllipse(BASE_WIDTH / 2, FLOOR_Y + 12, 190, 24);
    g.fillStyle(0xa8c0e4, 1).fillEllipse(BASE_WIDTH / 2, FLOOR_Y + 12, 160, 16);
    // Ventanal.
    g.fillStyle(0x3a3c44, 1).fillRect(32, 24, 116, 80);
    g.fillStyle(0x8a9cb0, 1).fillRect(34, 26, 112, 76);
    g.fillStyle(0x6a7c8c, 1).fillTriangle(34, 80, 74, 50, 114, 80);
    g.fillStyle(0x5a6c7c, 1).fillTriangle(70, 80, 112, 44, 146, 80);
    g.fillStyle(0x4c7050, 1).fillRect(34, 80, 112, 22);
    g.fillStyle(0x3a3c44, 1).fillRect(89, 24, 2, 80);
    // El póster de Valparaíso.
    g.fillStyle(0x2a2433, 1).fillRect(208, 34, 58, 44);
    g.fillStyle(0x7cb8e8, 1).fillRect(210, 36, 54, 40);
    for (const [x, y, c] of [[212, 62, 0xe85a5a], [224, 56, 0xf0c830], [236, 60, 0x58b868], [248, 52, 0xe8903c]] as const) g.fillStyle(c, 1).fillRect(x, y, 11, 76 - y);
    // La radio chiquita (la del celular en un vaso, para que suene más).
    g.fillStyle(0xa07c50, 1).fillRect(278, 94, 34, 44);
    g.fillStyle(0xc8e4f0, 1).fillRect(289, 80, 12, 15);
    g.fillStyle(0x1c1c24, 1).fillRect(292, 72, 6, 12);
  }

  private drawScene(): void {
    const f = this.figs;
    const h = this.hud;
    f.clear();
    h.clear();

    // La llovizna en el ventanal.
    for (const d of this.rain) {
      d.y += 1.6;
      if (d.y > 100) d.y = 27;
      f.fillStyle(0xc8e4ff, 0.7).fillRect(d.x, Math.round(d.y), 1, 3);
    }

    const beatMs = this.round.beatMs;
    const phase = this.phase === 'play' ? (this.clock / beatMs) % 1 : (this.time.now / 600) % 1;
    const bob = phase < 0.5 ? 1 : 0;
    const gap = 44 - this.closeness * 18;
    const cx = BASE_WIDTH / 2;
    const top = FLOOR_Y - 58;
    const sway = this.stepSide * 3;
    const me: SideFigureOpts = { dir: 1, scale: 1, eyes: 'open' };
    const her: SideFigureOpts = { dir: this.spin > 0.5 ? 1 : -1, scale: 0.94, eyes: this.closeness >= 0.8 ? 'closed' : 'open' };

    f.save();
    f.translateCanvas(Math.round(cx - gap / 2 - 12 + sway), top + bob);
    drawSideBody(f, this.meLook, me);
    drawSideArm(f, this.meLook, me, true);
    f.restore();
    f.save();
    f.translateCanvas(Math.round(cx + gap / 2 - 8 + sway), top + 3 - bob - Math.round(this.spin * 3));
    drawSideBody(f, this.siraLook, her);
    drawSideArm(f, this.siraLook, her, true);
    f.restore();
    // Notitas que salen de la radio.
    const n = Math.floor(this.time.now / 500) % 3;
    f.fillStyle(0xe8607a, 1).fillRect(286 + n * 8, 60 - n * 6, 3, 2).fillRect(288 + n * 8, 54 - n * 6, 1, 6);

    // Cinta de pasos.
    h.fillStyle(0x0c1020, 0.75).fillRect(0, 0, BASE_WIDTH, 15);
    h.fillStyle(0x0c1020, 0.75).fillRect(0, BASE_HEIGHT - 13, BASE_WIDTH, 13);
    for (let i = 0; i < ROUNDS.length; i++) {
      const on = i < this.score;
      h.fillStyle(on ? 0xf8e070 : 0x3a4060, 1).fillCircle(BASE_WIDTH - 40 + i * 12, 7, 4);
    }
    h.fillStyle(0x0c1020, 0.7).fillRoundedRect(8, LANE_Y - 11, BASE_WIDTH - 16, 22, 5);
    h.fillStyle(0xf8e070, 0.3).fillRect(TARGET_X - 9, LANE_Y - 11, 18, 22);
    h.lineStyle(1, 0xf8e070, 1).strokeRect(TARGET_X - 9, LANE_Y - 11, 18, 22);

    if (this.phase !== 'play') return;
    this.notes.forEach((note, i) => {
      const x = TARGET_X + ((note.beat * beatMs - this.clock) / beatMs) * PX_PER_BEAT;
      const label = this.noteLabels[i];
      const visible = note.state === 'wait' && x > 14 && x < BASE_WIDTH - 14;
      label.setVisible(visible);
      if (!visible) return;
      h.fillStyle(0x14182a, 1).fillCircle(x, LANE_Y, 8);
      h.fillStyle(KEY_COLOR[note.key], 1).fillCircle(x, LANE_Y, 7);
      label.setPosition(Math.round(x), LANE_Y);
    });
  }

  private say(text: string, ms: number): void {
    this.sayText.setText(text).setPosition(216, 82).setVisible(true);
    this.sayMs = ms;
  }

  private float(text: string, color: string, x: number, y: number): void {
    const t = this.addText(Math.round(x), y, text, { fontSize: '8px', fontStyle: '600', color, stroke: '#14182a', strokeThickness: 3 }).setOrigin(0.5).setDepth(12);
    this.floats.push({ t, life: 0.7 });
  }

  private banner(text: string): void {
    this.bannerText.setText(text).setVisible(true);
    const b = this.bannerText.getBounds();
    this.bannerBg.clear().fillStyle(0xfbf6ee, 0.96).fillRoundedRect(b.x - 8, b.y - 6, b.width + 16, b.height + 12, 6).setVisible(true);
    this.bannerBg.lineStyle(1, 0x2a2433, 1).strokeRoundedRect(b.x - 8, b.y - 6, b.width + 16, b.height + 12, 6);
  }

  private hideBanner(): void {
    this.bannerText.setVisible(false);
    this.bannerBg.setVisible(false);
  }
}
