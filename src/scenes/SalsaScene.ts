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
  /** Misión 8: bailar en la Calle Real de Salento, de noche, con quien invitaste (id de sprites.json). */
  partner?: string;
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
/** Lo que tarda la música en sonar después de pedirla (la agenda de audio va un poco adelantada). */
const MUSIC_LEAD_MS = 60;
const PASS_RATE = 0.7;
const FLOOR_Y = 138;

const KEY_LABEL: Record<Step, string> = { left: 'A', right: 'D', interact: 'E' };
const KEY_COLOR: Record<Step, number> = { left: 0x4a9ad8, right: 0xe8903c, interact: 0xe8607a };
const COUNTS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const MISS_LINES = ['¡Me pisaste!', '¡El cuatro se descansa!', 'Uno, dos, tres...', '¡Ay, mi pie!', 'Mírame a mí, no al piso'];
const HIT_LINES = ['¡Eso!', '¡Así, chileno!', '¡Ahí está!', 'Ya casi eres caleño'];

/** Con quién se baila: rondas, frases y cómo termina. Por defecto, Sira en el depa (misión 7). */
interface DanceStyle {
  name: string;
  look: string;
  rounds: Round[];
  miss: string[];
  hits: string[];
  quit: string;
  pass: string;
  fail: string;
  end: [perfect: string, some: string, none: string];
  street: boolean;
  /** Misión 9: bajo la pérgola del patio de Tami, con Cali prendida abajo (en vez de la Calle Real). */
  pergola?: boolean;
}

const SIRA_STYLE: DanceStyle = {
  name: 'Sira',
  look: 'sira_m7_polera',
  rounds: ROUNDS,
  miss: MISS_LINES,
  hits: HIT_LINES,
  quit: 'Sira: «¿Te rendiste? Bueno, esa la bailo sola.»',
  pass: 'Sira: «¡Eso, chileno!»',
  fail: 'Sira: «Me pisaste, pero con cariño.»',
  end: [
    'Sira: «¿Y tú me dijiste que no sabías bailar? ...Mentiroso. Lindo, pero mentiroso.»',
    'Sira: «Bueno. Ya no eres un peligro público. Eres un peligro de barrio.»',
    'Sira: «Me pisaste once veces. Las conté. Igual no quiero parar.»',
  ],
  street: false,
};

/** Misión 8: en la Calle Real, con la música de la tienda de doña Gladys. Cada pareja baila distinto. */
const CALLE_STYLES: Record<string, Omit<DanceStyle, 'look' | 'street'>> = {
  // Misión 9: Laura, bajo la pérgola de la casa de Tami (arriba de Cristo Rey).
  laura: {
    name: 'Laura',
    pergola: true,
    rounds: [
      { title: 'Salsa (como puede)', intro: 'Laura: «Vale, en Bilbao esto no se baila. Tú me guías y yo hago como que sé, ¿vale?»\nA / D: pasos', hint: 'A / D cuando el paso llegue a la marca · Esc: saltar', beatMs: 540, build: () => repeat(BASIC) },
      { title: 'La vuelta', intro: 'Laura: «Ahora la vuelta. Si me caigo a la piscina, te tiro conmigo.»\nA / D: pasos · E: la vuelta', hint: 'E: la vuelta en el 5 · Esc: saltar', beatMs: 500, build: () => repeat(TURN) },
      { title: 'A lo Bilbao', intro: 'Laura: «Y la última a mi manera: saltando y gritando, como en las fiestas de Aste Nagusia. ¡Aupa!»\nA / D · E', hint: 'Salta con ella · Esc: saltar', beatMs: 450, build: () => repeat(TURN) },
    ],
    miss: ['¡Ay, el pie!', '¡Que me pisas, tío!', '¡Hostia!', 'Mírame a mí, no al suelo'],
    hits: ['¡Eso, chileno!', '¡Aupa!', '¡Qué arte!', 'Vale, vale, sabes bailar'],
    quit: 'Laura: «¿Ya? Bueno, me lo apunto: me debes un baile.»',
    pass: 'Laura: «¡Bai! ¡Así!»',
    fail: 'Laura: «Bailamos fatal. Pero bailamos fatal juntos.»',
    end: [
      'Laura: «¿Y tú me dijiste que bailabas mal? Mentiroso. Me has engañado, chileno.»',
      'Laura: «No ha estado nada mal. Para ser del sur y yo del norte, nos hemos encontrado en el medio.»',
      'Laura: «Me has pisado como diez veces. Las he contado. Pero me lo he pasado bomba.»',
    ],
  },
  tami: {
    name: 'Tami',
    rounds: [
      { title: 'Salsa caleña', intro: 'Tami: «Acá se baila con los pies rápidos, chileno. Uno-dos-tres, cinco-seis-siete. Seguime.»\nA / D: pasos', hint: 'A / D cuando el paso llegue a la marca · Esc: saltar', beatMs: 520, build: () => repeat(BASIC) },
      { title: 'La vuelta', intro: 'Tami: «Ahora me das la vuelta. Suave... ¡pero no tan suave!»\nA / D: pasos · E: la vuelta', hint: 'E: la vuelta en el 5 · Esc: saltar', beatMs: 480, build: () => repeat(TURN) },
      { title: 'Caleño de verdad', intro: 'Tami: «La última es a lo caleño. Si me seguís esta, te adopto.»\nA / D: pasos · E: la vuelta', hint: 'No mires los pies · Esc: saltar', beatMs: 420, build: () => repeat(TURN) },
    ],
    miss: ['¡Ay, el pie!', 'Más rápido, más rápido', '¡Uy, chileno!', 'Seguime a mí'],
    hits: ['¡Eso, papi!', '¡Así se baila en Cali!', '¡Uy, qué nivel!', 'Mmm... me gusta'],
    quit: 'Tami: «¿Ya te cansaste? Yo apenas estaba calentando.»',
    pass: 'Tami: «¡Eso! Vos tenés sabor.»',
    fail: 'Tami: «Mmm. Hay que practicar. Conmigo, obvio.»',
    end: [
      'Tami: «Bailás demasiado rico para ser chileno. Ojo con eso.»',
      'Tami: «No está mal. Con unas clases mías quedás listo.»',
      'Tami: «Me pisaste toda. Igual me gustó el intento.»',
    ],
  },
  renzo: {
    name: 'Renzo',
    rounds: [
      { title: 'Huaylas (dice él)', intro: 'Renzo: «Esto no es salsa, causa: es un huaylas. Zapateas y ya.»\nA / D: zapateo', hint: 'A / D al ritmo · Esc: saltar', beatMs: 560, build: () => repeat(BASIC) },
      { title: 'La vuelta peruana', intro: 'Renzo: «Ahora me haces girar. Con cuidado que tengo el chicharrón en la mano.»\nA / D · E: vuelta', hint: 'E: la vuelta · Esc: saltar', beatMs: 520, build: () => repeat(TURN) },
      { title: 'El trencito', intro: 'Renzo: «Y cerramos con el trencito. Pero de dos. Es un trencito chiquito.»\nA / D · E', hint: 'Esc: saltar', beatMs: 480, build: () => repeat(TURN) },
    ],
    miss: ['¡Ay, mi juanete!', '¡Habla, causa!', '¡Ese pie es mío!', 'Asu mare...'],
    hits: ['¡Eso, causa!', '¡Arequipa te saluda!', '¡Qué tal pasos!', '¡Chévere!'],
    quit: 'Renzo: «Te entiendo, causa. Yo tampoco me aguanto.»',
    pass: 'Renzo: «¡Chévere, causa!»',
    fail: 'Renzo: «Bailamos como dos osos. Dos osos felices.»',
    end: [
      'Renzo: «Somos la pareja revelación de Salento. Que nadie nos diga nada.»',
      'Renzo: «Nada mal. Doña Gladys nos aplaudió. Bueno, se rio. Es lo mismo.»',
      'Renzo: «Asu, causa. Mejor nos quedamos con el tequila.»',
    ],
  },
  gladys: {
    name: 'Doña Gladys',
    rounds: [
      { title: 'Pasillo', intro: 'Doña Gladys: «Esto es un pasillo, mijo. Despacito y con elegancia, como en el Quindío.»\nA / D: pasos', hint: 'A / D · Esc: saltar', beatMs: 640, build: () => repeat(BASIC) },
      { title: 'La vuelta de la abuela', intro: 'Doña Gladys: «Ahora me da la vueltica. Ojo con la cadera, que es de titanio.»\nA / D · E', hint: 'E: la vuelta · Esc: saltar', beatMs: 600, build: () => repeat(TURN) },
      { title: 'Bambuco final', intro: 'Doña Gladys: «Y un bambuco para cerrar. Así bailaba yo con mi difunto.»\nA / D · E', hint: 'Esc: saltar', beatMs: 560, build: () => repeat(TURN) },
    ],
    miss: ['¡Ay, mijo!', 'Despacito...', 'Así no era mi difunto', '¡La cadera!'],
    hits: ['¡Eso, mijo!', '¡Qué caballero!', '¡Ay, qué bonito!', 'Usted tiene escuela'],
    quit: 'Doña Gladys: «Tranquilo, mijo, que yo también me canso.»',
    pass: 'Doña Gladys: «¡Así se baila, mijo!»',
    fail: 'Doña Gladys: «Le falta, pero tiene corazón.»',
    end: [
      'Doña Gladys: «Mijo, usted baila como mi difunto. Y eso es un piropo.»',
      'Doña Gladys: «Muy bien. Le regalo una cerveza. Una sola, ¿oyó?»',
      'Doña Gladys: «No sabe bailar, pero es muy educado. Algo es algo.»',
    ],
  },
  danilo: {
    name: 'Danilo',
    rounds: [
      { title: 'Salsa choke', intro: 'Danilo: «Ah ve, esto es salsa choke, parce. Es más de hombros que de pies. Es terapéutico.»\nA / D', hint: 'A / D · Esc: saltar', beatMs: 500, build: () => repeat(BASIC) },
      { title: 'El paso del psicólogo', intro: 'Danilo: «Este paso lo inventé yo. Se llama «la catarsis». E para la vuelta.»\nA / D · E', hint: 'E: la vuelta · Esc: saltar', beatMs: 470, build: () => repeat(TURN) },
      { title: 'Caleño a muerte', intro: 'Danilo: «Y el final: caleño a muerte. Si fallás, es por represión.»\nA / D · E', hint: 'Esc: saltar', beatMs: 430, build: () => repeat(TURN) },
    ],
    miss: ['¡Represión, ve!', 'Eso fue un acto fallido', 'Soltá los hombros', '¡Ve, el pie!'],
    hits: ['¡Ahí está, parce!', '¡Catarsis!', '¡Ah ve, qué chimba!', 'Vojabés, eso es sanar'],
    quit: 'Danilo: «Ah ve, huir del baile también es una respuesta.»',
    pass: 'Danilo: «¡Eso, parce! Sanaste.»',
    fail: 'Danilo: «Hay bloqueo. Lo trabajamos.»',
    end: [
      'Danilo: «Vos no necesitás terapia, necesitás una pista de baile.»',
      'Danilo: «Bien, bien. Hay avance terapéutico.»',
      'Danilo: «Mor, esto lo vamos a tener que trabajar en sesión.»',
    ],
  },
};

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
  private style: DanceStyle = SIRA_STYLE;

  constructor() {
    super('Salsa');
    this.fixedCamera = true;
  }

  init(data: SalsaSceneData): void {
    this.done = data.done;
    const calle = data.partner ? CALLE_STYLES[data.partner] : undefined;
    this.style = calle && data.partner ? { ...calle, look: data.partner, street: true } : SIRA_STYLE;
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
    this.siraLook = (characterLook(this.style.look) as HumanLook | undefined) ?? this.meLook;
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
    if (this.style.pergola) this.drawPergola();
    else if (this.style.street) this.drawStreet();
    else this.drawRoom();
    this.setupZoom();
    playMusic('salsa');
    setAmbient({ rain: 'none', indoor: !this.style.street });
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.startRound(0);
  }

  // -------------------------------------------------------------------------
  // Rondas
  // -------------------------------------------------------------------------

  private get round(): Round {
    return this.style.rounds[this.roundIdx];
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
    this.titleText.setText(`Ronda ${i + 1}/${this.style.rounds.length} · ${this.round.title}`);
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
    if (this.roundIdx + 1 < this.style.rounds.length) {
      this.startRound(this.roundIdx + 1);
      return;
    }
    this.phase = 'end';
    const [perfect, some, none] = this.style.end;
    const verdict = this.score === this.style.rounds.length ? perfect : this.score >= 1 ? some : none;
    this.banner(`${verdict}\n(E para seguir)`);
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    const result: SalsaResult = { score: this.score, total: this.style.rounds.length, perfect: this.score === this.style.rounds.length, hits: this.hits, notes: this.total };
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
      // La música vuelve a empezar al tempo de la ronda: los 8 tiempos de cuenta son sus dos primeros compases.
      playMusic('salsa', 60000 / this.round.beatMs);
      this.clock -= MUSIC_LEAD_MS;
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
      this.finishRound(false, this.style.quit);
      return;
    }
    const beatMs = this.round.beatMs;
    const beatNow = Math.floor(this.clock / beatMs);
    if (beatNow !== this.lastBeat) {
      this.lastBeat = beatNow;
      // Módulo siempre positivo: con el adelanto de la música el reloj parte un poco antes del tiempo −8.
      this.countText.setText(COUNTS[((beatNow % 8) + 8) % 8]);
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
      this.finishRound(ok, `${ok ? this.style.pass : this.style.fail} (${pct}% de los pasos)`);
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
    if (this.streak > 0 && this.streak % 8 === 0) this.say(this.style.hits[Math.floor(this.streak / 8 - 1) % this.style.hits.length], 900);
  }

  private judgeMiss(n: Note): void {
    n.state = 'miss';
    this.total++;
    this.streak = 0;
    this.float('¡Ups!', '#ff9c9c', TARGET_X + 40, LANE_Y + 20);
    if (Math.random() < 0.45) {
      playSfx('golpe');
      this.say(this.style.miss[Math.floor(Math.random() * this.style.miss.length)], 800);
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

  /** Misión 9: la pérgola del patio de Tami, arriba de Cristo Rey, con toda Cali prendida abajo y los amigos bailando. */
  private drawPergola(): void {
    const g = this.bg;
    g.fillStyle(0x0c1428, 1).fillRect(0, 0, BASE_WIDTH, FLOOR_Y);
    for (let i = 0; i < 30; i++) g.fillStyle(0xf8f4ec, 0.7).fillRect((i * 53) % BASE_WIDTH, (i * 29) % 34, 1, 1);
    // Cali allá abajo: un mar de lucecitas.
    g.fillStyle(0x1c2440, 1).fillRect(0, 70, BASE_WIDTH, FLOOR_Y - 70);
    for (let i = 0; i < 260; i++) g.fillStyle([0xf8dc68, 0xf8f4ec, 0xe8a040, 0x9cd0f0][i % 4], 0.85).fillRect((i * 37) % BASE_WIDTH, 74 + ((i * 13) % (FLOOR_Y - 80)), 1, 1);
    // Los postes y las vigas de la pérgola, con guirnaldas de ampolletas.
    g.fillStyle(0x6a4428, 1).fillRect(0, 20, BASE_WIDTH, 6).fillRect(0, 32, BASE_WIDTH, 3);
    for (let x = 14; x < BASE_WIDTH; x += 72) g.fillStyle(0x5a3a20, 1).fillRect(x, 20, 7, FLOOR_Y - 20);
    for (let x = 0; x < BASE_WIDTH; x += 10) g.fillStyle([0xf8dc68, 0xe868a8, 0x58d4d0][(x / 10) % 3], 1).fillRect(x, 40 + Math.round(Math.sin(x / 26) * 4), 2, 2);
    // Los amigos bailando de fondo (siluetas).
    for (const x of [40, 70, 250, 286]) {
      g.fillStyle(0x2a2433, 1).fillCircle(x, FLOOR_Y - 34, 5).fillRect(x - 5, FLOOR_Y - 29, 10, 22);
    }
    // El piso de deck.
    g.fillStyle(0x8c6a48, 1).fillRect(0, FLOOR_Y, BASE_WIDTH, BASE_HEIGHT - FLOOR_Y);
    for (let x = 0; x < BASE_WIDTH; x += 14) g.fillStyle(0x6a4c30, 1).fillRect(x, FLOOR_Y, 1, BASE_HEIGHT - FLOOR_Y);
    this.rain = [];
  }

  /** Misión 8: la Calle Real de noche, con las casas de colores, la tienda de doña Gladys y las guirnaldas. */
  private drawStreet(): void {
    const g = this.bg;
    g.fillStyle(0x141c34, 1).fillRect(0, 0, BASE_WIDTH, FLOOR_Y);
    for (let i = 0; i < 30; i++) g.fillStyle(0xf8f4ec, 0.7).fillRect((i * 53) % BASE_WIDTH, (i * 29) % 40, 1, 1);
    const colors = [0xc8303c, 0x2c64c0, 0x2c9c58, 0xe8b828, 0x7c3ca8, 0x1ca8a8];
    for (let i = 0; i < 6; i++) {
      const x = i * 56 - 8;
      g.fillStyle(0x8c3a1c, 1).fillTriangle(x - 4, 52, x + 30, 34, x + 64, 52);
      g.fillStyle(0xf4f0e6, 1).fillRect(x, 52, 56, FLOOR_Y - 52);
      g.fillStyle(colors[i], 1).fillRect(x + 6, 62, 14, 22).fillRect(x + 32, 60, 18, 12).fillRect(x + 30, 72, 22, 3);
      g.fillStyle(0xf8dc68, 0.8).fillRect(x + 34, 62, 14, 8);
    }
    // La tienda de doña Gladys, con la puerta abierta y el parlante.
    g.fillStyle(0x3a2418, 1).fillRect(232, 84, 34, FLOOR_Y - 84);
    g.fillStyle(0xf8e8a8, 0.85).fillRect(235, 88, 28, FLOOR_Y - 88);
    g.fillStyle(0x1c1824, 1).fillRect(270, 104, 14, 34);
    for (let x = 0; x < BASE_WIDTH; x += 12) g.fillStyle([0xf8dc68, 0xe868a8, 0x58d4d0][(x / 12) % 3], 1).fillRect(x, 46 + Math.round(Math.sin(x / 30) * 3), 2, 2);
    g.fillStyle(0x6c6c70, 1).fillRect(0, FLOOR_Y, BASE_WIDTH, BASE_HEIGHT - FLOOR_Y);
    for (let x = 0; x < BASE_WIDTH; x += 10) g.fillStyle(0x8c8c8c, 1).fillRect(x + ((x / 10) % 2) * 4, FLOOR_Y + 6, 6, 4).fillRect(x, FLOOR_Y + 22, 6, 4);
    this.rain = [];
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
    for (let i = 0; i < this.style.rounds.length; i++) {
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
