import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import { bust, type BustOpts } from '../art/vinetas_m5';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import { playerLook } from '../systems/PlayerLook';
import { MiniScene } from './MiniScene';

/**
 * Misión 9: los juegos de la fiesta en la casa de Tami, arriba de Cristo Rey. Cada modo tiene su mecánica:
 *  - `curvas`: el taxi sube por la vía a Cristo Rey y tú vas al medio del asiento de atrás, entre Laura y Mila.
 *    En cada curva el cuerpo se va para un lado: compensa con A/D para no aplastar a nadie. Diez curvas.
 *  - `beerpong`: contra Juanpa y Richi. La marca va y viene: E fija la puntería y E otra vez lanza con la fuerza
 *    de la barra. Se turnan; gana el que vacía primero los seis vasos del otro.
 *  - `cacho`: el cacho peruano (cubilete y cinco dados) con Mila y Renzo. Hasta tres tiradas por ronda: A/D
 *    eligen un dado, E lo guarda o lo suelta, W vuelve a tirar los sueltos y S se planta. Tres rondas.
 *  - `gallina`: la pelea de gallinas en la piscina, con Roxane en los hombros contra Juanpa y Ximena. A/D para no
 *    perder el equilibrio y E cuando la marca pasa por la zona verde para empujar. Al mejor de tres caídas.
 * Esc salta el juego.
 */

export type FiestaMode = 'curvas' | 'beerpong' | 'cacho' | 'gallina';

export interface FiestaResult {
  mode: FiestaMode;
  /** Curvas bien tomadas, vasos embocados, rondas de cacho o caídas ganadas. */
  score: number;
  /** Bien hecho (pocas aplastadas, ganaste el partido, la ronda o la pelea). */
  good: boolean;
  /** Curvas: todas perfectas; beer pong: sin errar ninguno; cacho: sacaste quina; gallina: 2 a 0. */
  perfect: boolean;
  skipped: boolean;
}

export interface FiestaSceneData {
  mode: FiestaMode;
  done: (r: FiestaResult) => void;
}

const INTROS: Record<FiestaMode, { title: string; text: string; hint: string }> = {
  curvas: {
    title: 'La subida a Cristo Rey',
    text: 'Don Hernán: «Agárrense, que ahora vienen las curvas, ve.»\nVas al medio, entre Laura y Mila. En cada curva compensa con A/D\npara no aplastar a nadie.',
    hint: 'A/D: compensar la curva · Esc: saltar',
  },
  beerpong: {
    title: 'Beer pong · Tú contra Juanpa y Richi',
    text: 'Juanpa: «Parce, acá en Cali el beer pong es deporte olímpico.»\nE fija la puntería, E otra vez lanza con la fuerza de la barra.\nGana el que vacía primero los seis vasos del otro.',
    hint: 'E: fijar puntería / lanzar · Esc: saltar',
  },
  cacho: {
    title: 'Cacho · Con Mila y Renzo',
    text: 'Mila: «En Lima esto es religión, chileno. Cinco dados, tres tiradas.»\nA/D: elegir dado · E: guardar o soltar · W: volver a tirar · S: plantarse.\nTres rondas: gana la mejor mano.',
    hint: 'A/D: dado · E: guardar · W: tirar · S: plantarse · Esc: saltar',
  },
  gallina: {
    title: 'Pelea de gallinas',
    text: 'Roxane se sube a tus hombros. «¡Ideay, chele! ¡No me vayás a botar!»\nA/D: mantener el equilibrio · E en la zona verde: ¡empujar!\nAl mejor de tres caídas contra Juanpa y Ximena.',
    hint: 'A/D: equilibrio · E: empujar · Esc: saltar',
  },
};

function look(id: string, fallback: HumanLook): HumanLook {
  return (characterLook(id) as HumanLook | undefined) ?? fallback;
}

// ---------------------------------------------------------------------------
// Cacho: las manos (de menor a mayor)
// ---------------------------------------------------------------------------

const HANDS = ['Nada', 'Par', 'Doble par', 'Trío', 'Escalera', 'Full', 'Póker', 'Quina'] as const;

/** Valor de una mano: categoría × 100 + desempate. */
export function cachoScore(dice: number[]): { rank: number; name: string; value: number } {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  const groups = counts.map((n, v) => ({ n, v })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n || b.v - a.v);
  const sorted = [...dice].sort((a, b) => a - b);
  const straight = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  let rank = 0;
  if (groups[0].n === 5) rank = 7;
  else if (groups[0].n === 4) rank = 6;
  else if (groups[0].n === 3 && groups[1]?.n === 2) rank = 5;
  else if (straight) rank = 4;
  else if (groups[0].n === 3) rank = 3;
  else if (groups[0].n === 2 && groups[1]?.n === 2) rank = 2;
  else if (groups[0].n === 2) rank = 1;
  const tie = groups.reduce((acc, g) => acc * 7 + g.v, 0) % 100;
  return { rank, name: HANDS[rank], value: rank * 100 + tie };
}

function roll(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** Un rival tira: guarda el número que más se repite y vuelve a tirar el resto (dos veces). */
function rivalHand(): number[] {
  let dice = [roll(), roll(), roll(), roll(), roll()];
  for (let t = 0; t < 2; t++) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dice) counts[d]++;
    let best = 1;
    for (let v = 1; v <= 6; v++) if (counts[v] >= counts[best]) best = v;
    if (cachoScore(dice).rank >= 4 && Math.random() < 0.8) break;
    dice = dice.map((d) => (d === best ? d : roll()));
  }
  return dice;
}

// ---------------------------------------------------------------------------

export class FiestaScene extends MiniScene<FiestaResult> {
  private mode: FiestaMode = 'curvas';
  private phase: 'intro' | 'play' | 'end' = 'intro';
  private score = 0;
  private skipped = false;
  private perfect = false;
  private good = false;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private bigText!: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[] = [];
  private elapsed = 0;
  private me!: HumanLook;

  // Curvas
  private curves: Array<{ dir: -1 | 1; force: number; ms: number }> = [];
  private curveIdx = 0;
  private curveMs = 0;
  private lean = 0;
  private leanV = 0;
  private curveWorst = 0;
  private squash = { laura: 0, mila: 0 };
  private squashCooldown = 0;

  // Beer pong
  private bpStep: 'aim' | 'power' | 'fly' | 'rival' | 'show' = 'aim';
  private aim = 0.5;
  private aimDir = 1;
  private pow = 0;
  private powDir = 1;
  private myCups: Array<{ x: number; y: number; on: boolean }> = [];
  private theirCups: Array<{ x: number; y: number; on: boolean }> = [];
  private ball = { t: 0, x0: 0, y0: 0, x1: 0, y1: 0, hit: -1, mine: true };
  private throws = 0;
  private misses = 0;
  private showMs = 0;

  // Cacho
  private dice: number[] = [1, 1, 1, 1, 1];
  private held = [false, false, false, false, false];
  private cursor = 0;
  private rolls = 0;
  private round = 0;
  private rivals: Array<{ name: string; dice: number[] }> = [];
  private cachoStep: 'roll' | 'reveal' = 'roll';
  private shakeMs = 0;
  private quina = false;

  // Gallina
  private bal = 0;
  private balV = 0;
  private push = 0;
  private pushDir = 1;
  private rivalBal = 0;
  private rivalCool = 0;
  private falls = { me: 0, them: 0 };
  private fallMs = 0;
  private fallWho: 'me' | 'them' | null = null;
  private splashT = 0;

  constructor() {
    super('Fiesta');
  }

  init(data: FiestaSceneData): void {
    this.initMini(data.done);
    this.mode = data.mode;
    this.phase = 'intro';
    this.score = 0;
    this.skipped = false;
    this.perfect = false;
    this.good = false;
    this.elapsed = 0;
    this.labels = [];
    // Curvas
    const dirs: Array<-1 | 1> = [1, -1, 1, 1, -1, 1, -1, -1, 1, -1];
    this.curves = dirs.map((dir, i) => ({ dir, force: 0.8 + (i % 4) * 0.22 + i * 0.03, ms: 2600 - i * 80 }));
    this.curveIdx = 0;
    this.curveMs = 0;
    this.lean = 0;
    this.leanV = 0;
    this.curveWorst = 0;
    this.squash = { laura: 0, mila: 0 };
    this.squashCooldown = 0;
    // Beer pong
    const tri = (cx: number, cy: number, down: boolean): Array<{ x: number; y: number; on: boolean }> => {
      const out: Array<{ x: number; y: number; on: boolean }> = [];
      const rows = [3, 2, 1];
      rows.forEach((n, r) => {
        for (let i = 0; i < n; i++) out.push({ x: cx + (i - (n - 1) / 2) * 13, y: cy + (down ? r : -r) * 11, on: true });
      });
      return out;
    };
    this.theirCups = tri(BASE_WIDTH / 2, 30, true);
    this.myCups = tri(BASE_WIDTH / 2, 146, false);
    this.bpStep = 'aim';
    this.aim = 0.5;
    this.pow = 0;
    this.throws = 0;
    this.misses = 0;
    // Cacho
    this.dice = [1, 1, 1, 1, 1];
    this.held = [false, false, false, false, false];
    this.cursor = 0;
    this.rolls = 0;
    this.round = 0;
    this.rivals = [];
    this.cachoStep = 'roll';
    this.quina = false;
    // Gallina
    this.bal = 0;
    this.balV = 0;
    this.push = 0;
    this.rivalBal = 0;
    this.rivalCool = 1.5;
    this.falls = { me: 0, them: 0 };
    this.fallMs = 0;
    this.fallWho = null;
  }

  create(): void {
    this.me = playerLook();
    this.g = this.add.graphics();
    this.hud = this.add.graphics().setDepth(40);
    const bg = { curvas: '#141c34', beerpong: '#2a2433', cacho: '#3a2418', gallina: '#0c2a44' }[this.mode];
    this.createUi(bg);
    this.infoText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', fontStyle: '600', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);
    this.bigText = this.addText(BASE_WIDTH / 2, 24, '', { fontSize: '10px', fontStyle: '700', color: '#f8e070', stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(52);
    const intro = INTROS[this.mode];
    this.titleText.setText(intro.title);
    this.hintText.setText(intro.hint);
    playMusic(this.mode === 'curvas' ? 'taxi_noche' : 'fiesta');
    this.banner(`${intro.text}\n(E para empezar)`);
    if (this.mode === 'cacho') this.newCachoRound();
  }

  override update(_t: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    const dt = Math.min(delta, 40) / 1000;
    if (this.phase === 'intro') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        this.phase = 'play';
        if (this.mode === 'cacho') this.rollDice();
      }
    } else if (this.phase === 'play') {
      this.elapsed += delta;
      if (Controls.consume('menu')) {
        this.skipped = true;
        this.endGame('Te saliste del juego. Nadie te lo va a reprochar... mucho.');
      } else if (this.mode === 'curvas') this.playCurvas(dt, delta);
      else if (this.mode === 'beerpong') this.playBeerpong(dt, delta);
      else if (this.mode === 'cacho') this.playCacho(delta);
      else this.playGallina(dt, delta);
    } else if (this.phase === 'end') {
      if (Controls.consume('interact')) this.finish({ mode: this.mode, score: this.score, good: this.good, perfect: this.perfect, skipped: this.skipped });
    }
    this.draw();
  }

  private endGame(verdict: string): void {
    this.phase = 'end';
    this.bigText.setText('');
    playSfx(this.good ? 'item' : 'cancel');
    this.banner(`${verdict}\n(E para seguir)`);
  }

  // -------------------------------------------------------------------------
  // Curvas
  // -------------------------------------------------------------------------

  private playCurvas(dt: number, delta: number): void {
    const c = this.curves[this.curveIdx];
    this.curveMs += delta;
    const k = Math.min(1, this.curveMs / c.ms);
    // La fuerza de la curva sube y baja (una campana); empuja hacia afuera de la curva.
    const f = Math.sin(k * Math.PI) * c.force * -c.dir;
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    this.leanV += (f * 2.4 + input * 2.6 - this.lean * 1.4) * dt;
    this.leanV *= 1 - 2.2 * dt;
    this.lean = Phaser.Math.Clamp(this.lean + this.leanV * dt, -1.2, 1.2);
    this.curveWorst = Math.max(this.curveWorst, Math.abs(this.lean));
    this.squashCooldown -= delta;
    if (Math.abs(this.lean) > 0.75 && this.squashCooldown <= 0) {
      this.squashCooldown = 900;
      playSfx('golpe');
      if (this.lean < 0) {
        this.squash.laura++;
        this.say(['¡Ay! ¡Que me espachurras, tío!', '¡Chileno, que me sacas por la ventana!', '¡Hostia, la rodilla!'][this.squash.laura % 3], 70, 60, 1100);
      } else {
        this.squash.mila++;
        this.say(['¡Oye, causa, mi pierna!', '¡Asu! ¡Que no soy cojín!', '¡Chileno, me estás sentando encima!'][this.squash.mila % 3], 250, 60, 1100);
      }
    }
    if (k >= 1) {
      const ok = this.curveWorst < 0.75;
      if (ok) {
        this.score++;
        this.float(this.curveWorst < 0.4 ? '¡Perfecta!' : 'Bien tomada', '#a8e0a0', BASE_WIDTH / 2, 70);
      } else this.float('¡Aplastada!', '#ff9c9c', BASE_WIDTH / 2, 70);
      if (this.curveIdx === 4) this.say('Ximena: «¡Agárrense, güeyes!»', BASE_WIDTH / 2, 30, 1300);
      if (this.curveIdx === 7) this.say('Don Hernán: «Esta curva me la sé de memoria, ve.»', BASE_WIDTH / 2, 30, 1300);
      this.curveIdx++;
      this.curveMs = 0;
      this.curveWorst = Math.abs(this.lean);
      if (this.curveIdx >= this.curves.length) {
        this.good = this.score >= 7;
        this.perfect = this.score === this.curves.length;
        const n = this.squash.laura + this.squash.mila;
        const verdict = this.perfect
          ? 'Diez de diez. Mila: «¡Este chileno maneja mejor el cuerpo que Don Hernán el taxi!»'
          : this.good
            ? `${this.score} curvas bien tomadas. Laura: «Vale, vale. Solo me has aplastado un poquito.»`
            : `${this.score} de 10. Aplastaste ${n} veces. Mila: «Causa, me debes una rodilla.»`;
        this.endGame(verdict);
      }
    }
    const nx = this.curves[this.curveIdx];
    this.bigText.setText(nx ? (nx.dir < 0 ? '⟵ curva a la izquierda' : 'curva a la derecha ⟶') : '');
  }

  // -------------------------------------------------------------------------
  // Beer pong
  // -------------------------------------------------------------------------

  private playBeerpong(dt: number, delta: number): void {
    if (this.bpStep === 'aim') {
      this.aim += this.aimDir * dt * 0.9;
      if (this.aim > 1 || this.aim < 0) (this.aimDir *= -1), (this.aim = Phaser.Math.Clamp(this.aim, 0, 1));
      if (Controls.consume('interact')) (this.bpStep = 'power'), (this.pow = 0), (this.powDir = 1);
    } else if (this.bpStep === 'power') {
      this.pow += this.powDir * dt * 1.2;
      if (this.pow > 1 || this.pow < 0) (this.powDir *= -1), (this.pow = Phaser.Math.Clamp(this.pow, 0, 1));
      if (Controls.consume('interact')) this.throwBall(true);
    } else if (this.bpStep === 'fly') {
      this.ball.t += dt * 1.6;
      if (this.ball.t >= 1) this.landBall();
    } else if (this.bpStep === 'show') {
      this.showMs -= delta;
      if (this.showMs <= 0) this.nextTurn();
    }
  }

  private throwBall(mine: boolean): void {
    const tableL = BASE_WIDTH / 2 - 40;
    if (mine) {
      const x1 = tableL + this.aim * 80;
      const y1 = 46 - (this.pow - 0.6) * 60;
      this.ball = { t: 0, x0: BASE_WIDTH / 2, y0: 168, x1, y1, hit: -1, mine: true };
      this.throws++;
    } else {
      // Juanpa y Richi: le apuntan a un vaso, con su error.
      const alive = this.myCups.filter((c) => c.on);
      const target = alive[Math.floor(Math.random() * alive.length)] ?? this.myCups[0];
      const err = Math.random() < 0.42 ? 2 : 9 + Math.random() * 9;
      const ang = Math.random() * Math.PI * 2;
      this.ball = { t: 0, x0: BASE_WIDTH / 2, y0: 12, x1: target.x + Math.cos(ang) * err, y1: target.y + Math.sin(ang) * err, hit: -1, mine: false };
    }
    this.bpStep = 'fly';
    playSfx('pinpon');
  }

  private landBall(): void {
    const cups = this.ball.mine ? this.theirCups : this.myCups;
    const i = cups.findIndex((c) => c.on && Math.hypot(c.x - this.ball.x1, c.y - this.ball.y1) <= 6.5);
    this.ball.hit = i;
    if (i >= 0) {
      cups[i].on = false;
      playSfx('chupito');
      if (this.ball.mine) {
        this.score++;
        this.float('¡AL VASO!', '#f8e070', cups[i].x, cups[i].y + 10);
        this.say(['Richi: «¡Achichay! ¡Qué puntería, ve!»', 'Juanpa: «¡Nooo, parce! ¡Tómese ese!»', 'Richi: «Ala, este chileno juega en serio.»'][this.score % 3], BASE_WIDTH / 2, 70, 1200);
      } else {
        this.float('¡Te embocaron!', '#ff9c9c', cups[i].x, cups[i].y - 10);
        this.say(['Juanpa: «¡Tenga! ¡A tomar, chileno!»', 'Richi: «¡Ayayay! ¡Pa dentro!»'][Math.floor(Math.random() * 2)], BASE_WIDTH / 2, 110, 1200);
      }
    } else {
      playSfx('pinpon');
      if (this.ball.mine) this.misses++;
      this.float('afuera', '#c0c8d8', this.ball.x1, this.ball.y1);
    }
    this.bpStep = 'show';
    this.showMs = 700;
  }

  private nextTurn(): void {
    const theirLeft = this.theirCups.filter((c) => c.on).length;
    const mineLeft = this.myCups.filter((c) => c.on).length;
    if (theirLeft === 0 || mineLeft === 0 || this.throws >= 14) {
      this.good = theirLeft < mineLeft || theirLeft === 0;
      this.perfect = this.good && this.misses === 0;
      const verdict =
        theirLeft === 0
          ? `¡Ganaste! Vaciaste los seis vasos en ${this.throws} tiros. Juanpa se toma el último de un trago, por honor.`
          : mineLeft === 0
            ? 'Te vaciaron los seis. Richi: «Lo bueno viene en frasco chiquito, ve.» Te toca tomar.'
            : this.good
              ? `Se acabó el tiempo y vas ganando ${6 - theirLeft} a ${6 - mineLeft}. Juanpa pide revancha. Nadie le hace caso.`
              : `Se acabó el tiempo: pierdes ${6 - theirLeft} a ${6 - mineLeft}. Richi celebra como si fuera la final.`;
      this.endGame(verdict);
      return;
    }
    if (this.ball.mine) {
      this.bpStep = 'rival';
      this.time.delayedCall(450, () => this.throwBall(false));
    } else {
      this.bpStep = 'aim';
      this.aim = Math.random();
    }
  }

  // -------------------------------------------------------------------------
  // Cacho
  // -------------------------------------------------------------------------

  private newCachoRound(): void {
    this.held = [false, false, false, false, false];
    this.rolls = 0;
    this.cursor = 0;
    this.cachoStep = 'roll';
    this.rivals = [
      { name: 'Mila', dice: rivalHand() },
      { name: 'Renzo', dice: rivalHand() },
    ];
  }

  private rollDice(): void {
    this.dice = this.dice.map((d, i) => (this.held[i] && this.rolls > 0 ? d : roll()));
    this.rolls++;
    this.shakeMs = 350;
    playSfx('barajar');
    if (cachoScore(this.dice).rank === 7) {
      this.quina = true;
      this.float('¡¡QUINA!!', '#f8e070', BASE_WIDTH / 2, 70, 1.4);
      this.say('Mila: «¡¿QUINA?! ¡Asu mare, chileno!»', BASE_WIDTH / 2, 40, 1600);
    }
    if (this.rolls >= 3) this.reveal();
  }

  private playCacho(delta: number): void {
    this.shakeMs = Math.max(0, this.shakeMs - delta);
    if (this.cachoStep === 'reveal') {
      if (Controls.consume('interact')) {
        this.round++;
        if (this.round >= 3) {
          this.good = this.score >= 2;
          this.perfect = this.quina;
          const verdict =
            this.score === 3
              ? 'Tres de tres. Mila: «Te adopto. Eres limeño honorario.» Renzo: «Arequipeño, más bien.»'
              : this.score === 2
                ? 'Dos de tres. Renzo: «Bien jugado, causa. Pero la próxima en Arequipa.»'
                : this.score === 1
                  ? 'Una de tres. Mila: «Algo es algo. En Lima te dejaban lavando los vasos.»'
                  : 'Cero de tres. Mila te da una palmadita que casi te bota de la silla.';
          this.endGame(verdict);
        } else this.newCachoRound(), this.rollDice();
      }
      return;
    }
    if (Controls.consume('left')) this.cursor = (this.cursor + 4) % 5;
    if (Controls.consume('right')) this.cursor = (this.cursor + 1) % 5;
    if (Controls.consume('interact')) {
      this.held[this.cursor] = !this.held[this.cursor];
      playSfx('cursor');
    }
    if (Controls.consume('up')) this.rollDice();
    else if (Controls.consume('down')) this.reveal();
  }

  private reveal(): void {
    this.cachoStep = 'reveal';
    const mine = cachoScore(this.dice);
    const best = this.rivals.map((r) => ({ r, s: cachoScore(r.dice) })).sort((a, b) => b.s.value - a.s.value)[0];
    const won = mine.value > best.s.value;
    if (won) this.score++;
    playSfx('mesa');
    const lines = this.rivals.map((r) => `${r.name}: ${cachoScore(r.dice).name}`).join(' · ');
    this.bigText.setText(won ? `¡Ganas la ronda con ${mine.name}!` : `Gana ${best.r.name} (${best.s.name})`);
    this.say(`${lines}\n(E: ${this.round >= 2 ? 'terminar' : 'siguiente ronda'})`, BASE_WIDTH / 2, 150, 60000);
  }

  // -------------------------------------------------------------------------
  // Gallina
  // -------------------------------------------------------------------------

  private playGallina(dt: number, delta: number): void {
    this.splashT += dt;
    if (this.fallMs > 0) {
      this.fallMs -= delta;
      if (this.fallMs <= 0) {
        this.fallWho = null;
        this.bal = 0;
        this.balV = 0;
        this.rivalBal = 0;
        if (this.falls.me >= 2 || this.falls.them >= 2) {
          this.score = this.falls.them;
          this.good = this.falls.them >= 2;
          this.perfect = this.good && this.falls.me === 0;
          this.endGame(
            this.good
              ? this.perfect
                ? 'Dos a cero. Roxane grita desde tus hombros: «¡Somos invencibles, chele!» Ximena sale tosiendo agua y riéndose.'
                : 'Dos a uno. Roxane te abraza la cabeza desde arriba: «¡Ganamos, ideay!» No ves nada. No importa.'
              : 'Perdieron. Roxane sale del agua con los rulos en la cara: «La próxima yo te cargo a vos.»',
          );
        }
      }
      return;
    }
    // Tu equilibrio: se va solo para los lados (Roxane se mueve) y lo corriges con A/D.
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    const wobble = Math.sin(this.elapsed / 430) * 0.7 + Math.sin(this.elapsed / 170) * 0.35;
    this.balV += (wobble * 1.3 + input * 2.4 + this.bal * 0.9) * dt;
    this.balV *= 1 - 1.6 * dt;
    this.bal = Phaser.Math.Clamp(this.bal + this.balV * dt, -1, 1);
    // La marca de empuje.
    this.push += this.pushDir * dt * 1.4;
    if (this.push > 1 || this.push < 0) (this.pushDir *= -1), (this.push = Phaser.Math.Clamp(this.push, 0, 1));
    if (Controls.consume('interact')) {
      const sweet = Math.abs(this.push - 0.5) < 0.14;
      if (sweet) {
        this.rivalBal += 0.38 + Math.random() * 0.1;
        playSfx('splash');
        this.float('¡Empujón!', '#a8e0a0', 230, 60);
        this.say(['Roxane: «¡Dale, chele!»', 'Roxane: «¡Ideay! ¡Se están cayendo!»', 'Roxane: «¡Eso, eso, eso!»'][Math.floor(Math.random() * 3)], 110, 30, 900);
      } else {
        this.balV += (Math.random() < 0.5 ? -1 : 1) * 0.6;
        this.float('al aire', '#c0c8d8', 150, 70);
      }
    }
    // Juanpa y Ximena empujan cada tanto.
    this.rivalCool -= dt;
    this.rivalBal = Math.max(0, this.rivalBal - dt * 0.12);
    if (this.rivalCool <= 0) {
      this.rivalCool = 1.1 + Math.random() * 1.2;
      this.balV += (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.5);
      playSfx('splash');
      this.say(['Ximena: «¡Tíralos, Juanpa!»', 'Juanpa: «¡Pilas, parce!»', 'Ximena: «¡Órale, órale!»'][Math.floor(Math.random() * 3)], 230, 30, 900);
    }
    if (Math.abs(this.bal) >= 1) this.fall('me');
    else if (this.rivalBal >= 1) this.fall('them');
  }

  private fall(who: 'me' | 'them'): void {
    this.fallWho = who;
    this.fallMs = 1600;
    if (who === 'me') this.falls.me++;
    else this.falls.them++;
    playSfx('chapuzon');
    this.bigText.setText(who === 'me' ? '¡PLAF! Se cayeron ustedes' : '¡PLAF! ¡Se cayeron Juanpa y Ximena!');
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private label(x: number, y: number, text: string, color = '#fbf6ee', size = 7): void {
    const t = this.addText(Math.round(x), Math.round(y), text, { fontSize: `${size}px`, fontStyle: '600', color, stroke: '#14182a', strokeThickness: 2 }).setOrigin(0.5).setDepth(45);
    this.labels.push(t);
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    for (const t of this.labels) t.destroy();
    this.labels = [];
    if (this.mode === 'curvas') this.drawCurvas(g);
    else if (this.mode === 'beerpong') this.drawBeerpong(g);
    else if (this.mode === 'cacho') this.drawCacho(g);
    else this.drawGallina(g);
    const h = this.hud;
    h.clear();
    this.drawBars(h);
    if (this.mode === 'curvas') this.infoText.setText(`Curvas ${Math.min(this.curveIdx + 1, 10)}/10 · Bien: ${this.score}`);
    else if (this.mode === 'beerpong') this.infoText.setText(`Tú ${6 - this.theirCups.filter((c) => c.on).length} – ${6 - this.myCups.filter((c) => c.on).length} Juanpa y Richi`);
    else if (this.mode === 'cacho') this.infoText.setText(`Ronda ${Math.min(this.round + 1, 3)}/3 · Ganadas: ${this.score} · Tiradas: ${this.rolls}/3`);
    else this.infoText.setText(`Caídas: ustedes ${this.falls.me} – ${this.falls.them} ellos`);
  }

  private drawCurvas(g: Phaser.GameObjects.Graphics): void {
    // El taxi por dentro, visto desde el tablero: el asiento de atrás y, detrás, el vidrio con la ciudad.
    const sway = this.curves[this.curveIdx] ? Math.sin((this.curveMs / this.curves[this.curveIdx].ms) * Math.PI) * this.curves[this.curveIdx].dir : 0;
    g.fillStyle(0x1c1c24, 1).fillRect(0, 15, BASE_WIDTH, BASE_HEIGHT - 28);
    // El vidrio de atrás con las luces de Cali que se mueven con la curva.
    g.fillStyle(0x0c1428, 1).fillRoundedRect(46, 22, 228, 56, 8);
    for (let i = 0; i < 70; i++) {
      const x = 50 + ((i * 47 + sway * 60 + this.elapsed * 0.01) % 220 + 220) % 220;
      const y = 50 + ((i * 13) % 24);
      g.fillStyle([0xf8dc68, 0xf8f4ec, 0xe8a040][i % 3], 0.85).fillRect(x, y, 1, 1);
    }
    g.fillStyle(0x2a3048, 1).fillTriangle(46, 70, 160 + sway * 40, 46, 274, 70);
    g.fillStyle(0xf8dc68, 1).fillRect(140, 26, 40, 6);
    this.label(160, 29, 'TAXI', '#2a2433', 5);
    // El asiento.
    g.fillStyle(0x3a3a48, 1).fillRoundedRect(30, 74, 260, 70, 8);
    g.fillStyle(0x4a4a5c, 1).fillRoundedRect(36, 80, 248, 30, 6);
    const laura = look('laura', this.me);
    const mila = look('mila', this.me);
    const px = 160 + this.lean * 46;
    const lx = 82 - (this.lean < -0.6 ? 10 : 0) + sway * 4;
    const mx = 240 + (this.lean > 0.6 ? 10 : 0) + sway * 4;
    const lo: BustOpts = this.lean < -0.6 ? { eyes: 'squint', mouth: 'open' } : { mouth: 'smile' };
    const mo: BustOpts = this.lean > 0.6 ? { eyes: 'squint', mouth: 'open' } : { mouth: 'grin', eyes: 'squint' };
    bust(g, laura, lx, 92, 3.2, lo);
    bust(g, mila, mx, 92, 3.4, mo);
    bust(g, this.me, px, 94, 3.2, Math.abs(this.lean) > 0.6 ? { mouth: 'o' } : { mouth: 'smile' });
    // El medidor: qué tan cerca estás de aplastar a alguien.
    g.fillStyle(0x0c1020, 0.8).fillRoundedRect(60, 150, 200, 12, 4);
    g.fillStyle(0xc8303c, 0.6).fillRect(62, 152, 30, 8).fillRect(228, 152, 30, 8);
    g.fillStyle(0x2c9c58, 0.6).fillRect(128, 152, 64, 8);
    g.fillStyle(0xf8e070, 1).fillRect(Math.round(160 + this.lean * 80) - 2, 150, 4, 12);
    this.label(76, 145, 'Laura', '#f8c0c0');
    this.label(244, 145, 'Mila', '#f8c0c0');
  }

  private drawBeerpong(g: Phaser.GameObjects.Graphics): void {
    const L = BASE_WIDTH / 2 - 46;
    g.fillStyle(0x3a2418, 1).fillRect(0, 15, BASE_WIDTH, BASE_HEIGHT - 28);
    // La mesa (de arriba).
    g.fillStyle(0x14141c, 1).fillRect(L - 2, 16, 96, 164);
    g.fillStyle(0x2c64c0, 1).fillRect(L, 18, 92, 160);
    g.lineStyle(1, 0xf4f0e6, 0.6).lineBetween(L, 98, L + 92, 98);
    const cup = (c: { x: number; y: number; on: boolean }): void => {
      if (!c.on) {
        g.lineStyle(1, 0xf4f0e6, 0.25).strokeCircle(c.x, c.y, 5);
        return;
      }
      g.fillStyle(0x14141c, 1).fillCircle(c.x, c.y, 6);
      g.fillStyle(0xd8283c, 1).fillCircle(c.x, c.y, 5);
      g.fillStyle(0xf0c040, 1).fillCircle(c.x, c.y, 3);
    };
    this.theirCups.forEach(cup);
    this.myCups.forEach(cup);
    // Juanpa y Richi atrás; tú adelante.
    bust(g, look('juanpa', this.me), L - 30, 36, 2.6, { mouth: 'grin', eyes: 'squint' });
    bust(g, look('richi', this.me), L + 122, 38, 2.2, { mouth: 'open' });
    bust(g, this.me, L - 30, 150, 2.6, { mouth: 'smile' });
    if (this.bpStep === 'aim' || this.bpStep === 'power') {
      const x = L + this.aim * 92;
      g.lineStyle(1, 0xf8e070, 0.8).lineBetween(BASE_WIDTH / 2, 168, x, 40);
      g.fillStyle(0xf8e070, 1).fillTriangle(x - 3, 34, x + 3, 34, x, 40);
      // La barra de fuerza.
      g.fillStyle(0x0c1020, 0.8).fillRect(L + 112, 60, 10, 100);
      g.fillStyle(0x2c9c58, 0.5).fillRect(L + 112, 80, 10, 22);
      if (this.bpStep === 'power') g.fillStyle(0xf8e070, 1).fillRect(L + 110, 160 - this.pow * 100 - 2, 14, 4);
      this.label(L + 117, 54, 'fuerza', '#fbf6ee', 6);
    }
    if (this.bpStep === 'fly') {
      const b = this.ball;
      const x = b.x0 + (b.x1 - b.x0) * b.t;
      const y = b.y0 + (b.y1 - b.y0) * b.t;
      const z = Math.sin(b.t * Math.PI) * 26;
      g.fillStyle(0x000000, 0.3).fillCircle(x + 1, y + 1, 2);
      g.fillStyle(0xf8f4ec, 1).fillCircle(x, y - z, 2.5);
    }
    if (this.bpStep === 'rival') this.label(BASE_WIDTH / 2, 100, 'Tira Juanpa...', '#f8e070', 8);
  }

  private drawCacho(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x2c6a3c, 1).fillRoundedRect(20, 22, 280, 140, 10);
    g.fillStyle(0x245a32, 1).fillRoundedRect(28, 30, 264, 124, 8);
    bust(g, look('mila', this.me), 70, 50, 2.6, this.cachoStep === 'reveal' ? { mouth: 'grin', eyes: 'squint' } : { mouth: 'smile' });
    bust(g, look('renzo', this.me), 250, 50, 2.6, { mouth: 'open' });
    // El cubilete (se sacude).
    const sh = this.shakeMs > 0 ? Math.sin(this.shakeMs / 20) * 3 : 0;
    g.fillStyle(0x5a2a18, 1).fillRect(146 + sh, 34, 28, 26);
    g.fillStyle(0x7a3a24, 1).fillRect(148 + sh, 36, 24, 4);
    const pip = (cx: number, cy: number, v: number, s: number): void => {
      const pos: Record<number, Array<[number, number]>> = {
        1: [[0, 0]],
        2: [[-1, -1], [1, 1]],
        3: [[-1, -1], [0, 0], [1, 1]],
        4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
        6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
      };
      for (const [dx, dy] of pos[v]) g.fillStyle(0x14141c, 1).fillCircle(cx + dx * s * 0.6, cy + dy * s * 0.6, Math.max(1, s * 0.18));
    };
    // Mis dados.
    this.dice.forEach((d, i) => {
      const x = 80 + i * 40;
      const y = 112 + (this.held[i] ? -8 : 0) + (this.shakeMs > 0 && !this.held[i] ? Math.sin(this.shakeMs / 15 + i) * 4 : 0);
      g.fillStyle(0x14141c, 1).fillRoundedRect(x - 12, y - 12, 24, 24, 4);
      g.fillStyle(this.held[i] ? 0xf8e8a8 : 0xf8f4ec, 1).fillRoundedRect(x - 11, y - 11, 22, 22, 4);
      pip(x, y, d, 12);
      if (i === this.cursor && this.cachoStep === 'roll') g.lineStyle(2, 0xf8e070, 1).strokeRoundedRect(x - 14, y - 14, 28, 28, 5);
      if (this.held[i]) this.label(x, y + 18, 'guardado', '#f8e070', 5);
    });
    // Los dados de los rivales, chiquitos, al revelar.
    if (this.cachoStep === 'reveal') {
      this.rivals.forEach((r, k) => {
        r.dice.forEach((d, i) => {
          const x = (k === 0 ? 40 : 216) + i * 13;
          g.fillStyle(0xf8f4ec, 1).fillRoundedRect(x - 5, 72, 11, 11, 2);
          pip(x + 0.5, 77.5, d, 6);
        });
      });
    }
    const s = cachoScore(this.dice);
    this.label(BASE_WIDTH / 2, 142, `Tu mano: ${s.name}`, '#f8e070', 8);
  }

  private drawGallina(g: Phaser.GameObjects.Graphics): void {
    // La piscina de noche, con la ciudad atrás.
    g.fillStyle(0x0c1428, 1).fillRect(0, 15, BASE_WIDTH, 50);
    for (let i = 0; i < 80; i++) g.fillStyle([0xf8dc68, 0xf8f4ec, 0xe8a040][i % 3], 0.8).fillRect((i * 37) % BASE_WIDTH, 50 + ((i * 11) % 14), 1, 1);
    g.fillStyle(0x1c8ac8, 1).fillRect(0, 98, BASE_WIDTH, BASE_HEIGHT - 111);
    for (let x = 0; x < BASE_WIDTH; x += 8) g.fillStyle(0x58c8f0, 0.6).fillRect(x, 98 + Math.round(Math.sin(x / 14 + this.splashT * 3) * 2), 5, 1);
    const roxane = look('roxane', this.me);
    const juanpa = look('juanpa', this.me);
    const ximena = look('ximena', this.me);
    const pair = (x: number, tilt: number, bottom: HumanLook, top: HumanLook, fallen: boolean, mineSide: boolean): void => {
      if (fallen) {
        for (let i = 0; i < 8; i++) g.fillStyle(0xf8f4ec, 0.8).fillCircle(x + Math.sin(i * 2.1) * 18, 96 - (i % 3) * 6, 3);
        return;
      }
      const tx = x + tilt * 14;
      // El de abajo, con el agua hasta el pecho.
      g.fillStyle(Phaser.Display.Color.HexStringToColor(bottom.skin).color, 1).fillRect(x - 10, 92, 20, 8);
      bust(g, bottom, x, 82, 2.4, mineSide ? { mouth: 'teeth' } : { mouth: 'open' });
      // La de arriba, en los hombros.
      g.fillStyle(Phaser.Display.Color.HexStringToColor(top.shirt).color, 1).fillRect(tx - 9, 56, 18, 14);
      bust(g, top, tx, 48, 2.4, mineSide ? { mouth: 'grin', eyes: 'squint' } : { mouth: 'open' });
      g.fillStyle(Phaser.Display.Color.HexStringToColor(top.skin).color, 1).fillRect(tx + (mineSide ? 9 : -19), 58, 10, 3);
    };
    pair(118, this.bal, this.me, roxane, this.fallWho === 'me', true);
    pair(206, -this.rivalBal * 0.8 + Math.sin(this.elapsed / 300) * 0.15, juanpa, ximena, this.fallWho === 'them', false);
    // Medidores: tu equilibrio y la marca de empuje.
    g.fillStyle(0x0c1020, 0.8).fillRoundedRect(40, 140, 100, 10, 3);
    g.fillStyle(0x2c9c58, 0.6).fillRect(70, 142, 40, 6);
    g.fillStyle(0xf8e070, 1).fillRect(Math.round(90 + this.bal * 48) - 2, 140, 4, 10);
    this.label(90, 135, 'equilibrio', '#fbf6ee', 6);
    g.fillStyle(0x0c1020, 0.8).fillRoundedRect(180, 140, 100, 10, 3);
    g.fillStyle(0x2c9c58, 0.7).fillRect(216, 142, 28, 6);
    g.fillStyle(0xf8e070, 1).fillRect(Math.round(182 + this.push * 96) - 2, 140, 4, 10);
    this.label(230, 135, 'empujón (E)', '#fbf6ee', 6);
    g.fillStyle(0x0c1020, 0.8).fillRoundedRect(180, 154, 100, 6, 2);
    g.fillStyle(0xc8303c, 1).fillRect(181, 155, Math.round(98 * Math.min(1, this.rivalBal)), 4);
  }
}
