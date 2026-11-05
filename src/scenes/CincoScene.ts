import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { drawPanel, THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

/**
 * Misión 5: el Cinco, el juego de cartas que inventó Camilo (sí, se parece a otro), en la mesa larga de
 * Pance Burger. Cinco jugadores: tú, el profe Julián, Valentina, Sira y Camilo.
 *
 * Reglas: se tira una carta del mismo color o número (o símbolo) que la de la mesa; si no tienes, robas.
 * Especiales: «¡Quieto!» (salta al siguiente), «¡Pa'trás!» (cambia el sentido), «+2», el comodín (cambia
 * el color) y el «Aguacero» (comodín +4). Con una carta en la mano hay que gritar «¡CINCO!» (F); si no y
 * te pillan, robas dos (y tú puedes pillar a los demás con F). Cada vez que alguien tira un 5, todos
 * golpean la mesa (E): el último roba una carta.
 * Controles: A/D eligen carta, E la tira, W/S roba (o pasa después de robar), F grita «¡Cinco!».
 */

export interface CincoResult {
  /** Quién ganó: 0 = tú, 1 = profe, 2 = Valentina, 3 = Sira, 4 = Camilo. */
  winner: number;
  /** Fuiste el primero en golpear la mesa en todos los cincos (y hubo al menos uno). */
  mesaPerfecta: boolean;
}

export interface CincoSceneData {
  done: (r: CincoResult) => void;
}

type Color = 0 | 1 | 2 | 3;
type Kind = 'num' | 'quieto' | 'patras' | 'mas2' | 'comodin' | 'aguacero';

interface Card {
  id: number;
  kind: Kind;
  /** Color (los comodines no tienen hasta que se juegan). */
  color: Color | null;
  num?: number;
}

interface Seat {
  name: string;
  look: HumanLook;
  hand: Card[];
  /** Dónde se dibuja (centro del retrato). */
  x: number;
  y: number;
  /** Ya gritó «¡Cinco!» con su última carta. */
  called: boolean;
  /** Tiempo de reacción para golpear la mesa (ms). */
  reflex: [number, number];
  /** Probabilidad de acordarse de gritar «¡Cinco!». */
  memory: number;
  quips: { attack: string[]; hit: string[]; cinco: string[]; win: string };
}

const COLORS = ['#f0c030', '#2f6fd0', '#e84848', '#3cae5c'];
const COLOR_NAMES = ['amarillo', 'azul', 'rojo', 'verde'];
const CW = 22;
const CH = 32;
const PILE = { x: 172, y: 66 };
const DECK = { x: 132, y: 66 };
const HAND_Y = 140;
const AI_DELAY: [number, number] = [650, 1050];
const MESA_WINDOW = 1600;
const CINCO_WINDOW = 2200;

export class CincoScene extends BaseScene {
  private done!: (r: CincoResult) => void;
  private seats: Seat[] = [];
  private deck: Card[] = [];
  private pile: Card[] = [];
  private color: Color = 0;
  private turn = 0;
  private dir: 1 | -1 = 1;
  private sel = 0;
  /** Robaste en este turno: ahora puedes tirar una carta que sirva o pasar. */
  private drewThisTurn = false;
  private aiWait = 0;
  /** Elegir color del comodín (tú). */
  private choosing: { card: Card; color: number } | null = null;
  /** ¡Mesa!: quiénes ya golpearon y desde cuándo. */
  private mesa: { ms: number; order: number[]; ai: number[] } | null = null;
  private mesaCount = 0;
  private mesaFirst = 0;
  /** Alguien quedó con una carta sin gritar: ventana para pillarlo. */
  private cincoCheck: { who: number; ms: number; aiCatchAt: number } | null = null;
  private winner = -1;
  private finished = false;
  private busy = 0;
  private ui!: Phaser.GameObjects.Container;
  private table!: Phaser.GameObjects.Graphics;
  private logText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerMs = 0;
  private nextId = 0;
  private dirty = true;

  constructor() {
    super('Cinco');
    this.fixedCamera = true;
  }

  init(data: CincoSceneData): void {
    this.done = data.done;
    this.seats = [];
    this.deck = [];
    this.pile = [];
    this.turn = 0;
    this.dir = 1;
    this.sel = 0;
    this.drewThisTurn = false;
    this.aiWait = 0;
    this.choosing = null;
    this.mesa = null;
    this.mesaCount = 0;
    this.mesaFirst = 0;
    this.cincoCheck = null;
    this.winner = -1;
    this.finished = false;
    this.busy = 0;
    this.bannerMs = 0;
    this.nextId = 0;
    this.dirty = true;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2a1a12');
    this.table = this.add.graphics();
    this.drawTable();
    this.ui = this.add.container(0, 0).setDepth(5);
    this.turnText = this.addText(BASE_WIDTH / 2, 104, '', { fontSize: '9px', fontStyle: '600', color: '#f8e070', stroke: '#2a1a12', strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
    this.logText = this.addText(BASE_WIDTH / 2, 114, '', { fontSize: '8px', color: '#f4e8d8', stroke: '#2a1a12', strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 9, 'A/D: elegir · E: tirar · W: robar/pasar · F: ¡CINCO!', { fontFamily: FONT_HUD, fontSize: '7px', color: '#dccbb4' })
      .setOrigin(0.5, 0)
      .setDepth(6);
    this.bannerBg = this.add.graphics().setDepth(20);
    this.bannerText = this.addText(BASE_WIDTH / 2, 82, '', { fontSize: '12px', fontStyle: '600', color: THEME.ink, align: 'center', wordWrap: { width: 240 } })
      .setOrigin(0.5)
      .setDepth(21);
    this.hideBanner();

    this.setupSeats();
    this.newDeck();
    for (let i = 0; i < 7; i++) for (const s of this.seats) s.hand.push(this.draw());
    // La primera carta de la mesa: un número.
    let first = this.draw();
    while (first.kind !== 'num') {
      this.deck.unshift(first);
      first = this.draw();
    }
    this.pile.push(first);
    this.color = first.color as Color;
    this.sortHand();

    this.setupZoom();
    playMusic('hamburguesas');
    playSfx('barajar');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.banner('¡A jugar Cinco!\nEmpiezas tú. Mismo color o mismo número.', 2200);
    this.log('Camilo reparte siete cartas a cada uno. «La primera la tira el invitado».');
  }

  private setupSeats(): void {
    const look = (id: string): HumanLook => (characterLook(id) as HumanLook | undefined) ?? playerLook();
    this.seats = [
      {
        name: 'Tú',
        look: playerLook(),
        hand: [],
        x: 160,
        y: 168,
        called: false,
        reflex: [0, 0],
        memory: 1,
        quips: { attack: [], hit: [], cinco: [], win: '' },
      },
      {
        name: 'Profe Julián',
        look: look('profe_julian'),
        hand: [],
        x: 24,
        y: 66,
        called: false,
        reflex: [280, 650],
        memory: 0.9,
        quips: {
          attack: ['Esto va a la nota.', 'Con todo respeto, mijo: tome.', 'Optimización pura.'],
          hit: ['¡Ay! Respeten al profesor.', 'Esto lo voy a recordar en el parcial.'],
          cinco: ['¡CINCO! Lo dije primero, ¿vieron?'],
          win: '¡Les dije que era competitivo!',
        },
      },
      {
        name: 'Valentina',
        look: look('valentina'),
        hand: [],
        x: 100,
        y: 22,
        called: false,
        reflex: [340, 800],
        memory: 0.95,
        quips: {
          attack: ['Calculado.', 'Estaba en el cronograma.', 'Nada personal. Bueno, un poco.'],
          hit: ['Eso no estaba en el cronograma.', '¿En serio? Anotado.'],
          cinco: ['Cinco. Lo tenía planeado.'],
          win: 'Gané. Con colores.',
        },
      },
      {
        name: 'Sira',
        look: look('sira_noche'),
        hand: [],
        x: 220,
        y: 22,
        called: false,
        reflex: [300, 720],
        memory: 0.85,
        quips: {
          attack: ['Lo siento... no, no lo siento.', '¡Toma, chileno! Digo, toma, Camilo.', 'Ups.'],
          hit: ['¡Oye! ¿Así me tratas?', 'Me la vas a pagar en la piscina.'],
          cinco: ['¡CINCO! ¡Jajaja!'],
          win: '¡Nado y además juego cartas!',
        },
      },
      {
        name: 'Camilo',
        look: look('camilo'),
        hand: [],
        x: 296,
        y: 66,
        called: false,
        reflex: [240, 700],
        memory: 0.75,
        quips: {
          attack: ['¡Toma tu +2, parce!', '¡Palmira presente!', '¡Esa es la regla número cero!'],
          hit: ['¡Mi propio juego me traiciona!', 'Eso es trampa. No sé por qué, pero es trampa.'],
          cinco: ['¡CIIINCO! ¡Como dijo mi abuelo!'],
          win: '¡El que inventa, gana!',
        },
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Mazo
  // -------------------------------------------------------------------------

  private newDeck(): void {
    const cards: Card[] = [];
    const add = (kind: Kind, color: Color | null, num?: number): void => {
      cards.push({ id: this.nextId++, kind, color, num });
    };
    for (let c = 0; c < 4; c++) {
      const color = c as Color;
      add('num', color, 0);
      for (let n = 1; n <= 9; n++) {
        add('num', color, n);
        add('num', color, n);
      }
      for (const k of ['quieto', 'patras', 'mas2'] as const) {
        add(k, color);
        add(k, color);
      }
    }
    for (let i = 0; i < 4; i++) {
      add('comodin', null);
      add('aguacero', null);
    }
    Phaser.Utils.Array.Shuffle(cards);
    this.deck = cards;
  }

  private draw(): Card {
    if (this.deck.length === 0) {
      // Se acabó el mazo: se baraja la mesa (menos la de arriba).
      const top = this.pile.pop();
      this.deck = Phaser.Utils.Array.Shuffle(this.pile.map((c) => (c.kind === 'comodin' || c.kind === 'aguacero' ? { ...c, color: null } : c)));
      this.pile = top ? [top] : [];
      playSfx('barajar');
      this.log('Se acabó el mazo: Camilo baraja la mesa.');
    }
    return this.deck.pop() as Card;
  }

  private give(who: number, n: number): void {
    for (let i = 0; i < n; i++) this.seats[who].hand.push(this.draw());
    this.seats[who].called = false;
    if (who === 0) this.sortHand();
    playSfx('carta');
    this.dirty = true;
  }

  private sortHand(): void {
    const order = (c: Card): number => (c.color === null ? 400 : c.color * 100) + (c.kind === 'num' ? (c.num ?? 0) : { quieto: 20, patras: 21, mas2: 22, comodin: 30, aguacero: 31, num: 0 }[c.kind]);
    this.seats[0].hand.sort((a, b) => order(a) - order(b));
    this.sel = Phaser.Math.Clamp(this.sel, 0, Math.max(0, this.seats[0].hand.length - 1));
  }

  private top(): Card {
    return this.pile[this.pile.length - 1];
  }

  private playable(c: Card): boolean {
    if (c.kind === 'comodin' || c.kind === 'aguacero') return true;
    const t = this.top();
    if (c.color === this.color) return true;
    if (c.kind === 'num' && t.kind === 'num') return c.num === t.num;
    return c.kind !== 'num' && c.kind === t.kind;
  }

  private nextSeat(from = this.turn, steps = 1): number {
    return (((from + this.dir * steps) % 5) + 5) % 5;
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    if (this.bannerMs > 0) {
      this.bannerMs -= delta;
      if (this.bannerMs <= 0) this.hideBanner();
    }
    if (this.finished) {
      if (Controls.consume('interact')) this.finish();
      if (this.dirty) this.render();
      return;
    }

    if (this.mesa) {
      this.updateMesa(delta);
      if (this.dirty) this.render();
      return;
    }
    if (this.cincoCheck) this.updateCincoCheck(delta);
    if (this.busy > 0) {
      this.busy -= delta;
      if (this.dirty) this.render();
      return;
    }

    if (this.turn === 0) this.updateHuman();
    else {
      // F también sirve para pillar a otro que no gritó, aunque no sea tu turno.
      if (Controls.consume('trick')) this.humanCallCinco();
      this.aiWait -= delta;
      if (this.aiWait <= 0) this.aiTurn(this.turn);
    }
    if (this.dirty) this.render();
  }

  private updateHuman(): void {
    const hand = this.seats[0].hand;
    if (this.choosing) {
      if (Controls.consume('left')) (this.choosing.color = (this.choosing.color + 3) % 4), playSfx('cursor'), (this.dirty = true);
      if (Controls.consume('right')) (this.choosing.color = (this.choosing.color + 1) % 4), playSfx('cursor'), (this.dirty = true);
      if (Controls.consume('interact')) {
        const { card, color } = this.choosing;
        this.choosing = null;
        this.resolvePlay(0, card, color as Color);
      }
      return;
    }
    if (Controls.consume('left') && hand.length > 0) (this.sel = (this.sel + hand.length - 1) % hand.length), playSfx('cursor'), (this.dirty = true);
    if (Controls.consume('right') && hand.length > 0) (this.sel = (this.sel + 1) % hand.length), playSfx('cursor'), (this.dirty = true);
    if (Controls.consume('trick')) this.humanCallCinco();
    if (Controls.consume('up') || Controls.consume('down')) {
      if (this.drewThisTurn) {
        this.log('Pasas.');
        this.endTurn(0);
        return;
      }
      this.drewThisTurn = true;
      this.give(0, 1);
      const last = this.seats[0].hand.length;
      this.log(this.seats[0].hand.some((c) => this.playable(c)) ? 'Robas una. Tira una que sirva, o W para pasar.' : 'Robas una... y no te sirve. W para pasar.');
      this.sel = Math.min(this.sel, last - 1);
      return;
    }
    if (Controls.consume('interact') && hand.length > 0) {
      const card = hand[this.sel];
      if (!this.playable(card)) {
        playSfx('error');
        this.log(`Esa no sirve: en la mesa hay ${this.describeTop()}.`);
        return;
      }
      hand.splice(this.sel, 1);
      this.sel = Math.min(this.sel, Math.max(0, hand.length - 1));
      if (card.kind === 'comodin' || card.kind === 'aguacero') {
        // Elegir color: por defecto, el que más tienes.
        this.choosing = { card, color: this.bestColor(hand) };
        this.log('Elige el color: A/D y E.');
        this.dirty = true;
        return;
      }
      this.resolvePlay(0, card, card.color as Color);
    }
  }

  /** F: gritar «¡Cinco!» (si te queda una o dos cartas) o pillar al que no gritó. */
  private humanCallCinco(): void {
    const me = this.seats[0];
    if (this.cincoCheck && this.cincoCheck.who !== 0) {
      const who = this.cincoCheck.who;
      this.cincoCheck = null;
      playSfx('mesa');
      this.bubble(0, '¡No dijo CINCO!');
      this.bubble(who, this.pick(this.seats[who].quips.hit));
      this.log(`¡Pillaste a ${this.seats[who].name}! Roba dos.`);
      this.give(who, 2);
      return;
    }
    if (me.hand.length <= 2 && !me.called) {
      me.called = true;
      if (this.cincoCheck?.who === 0) this.cincoCheck = null;
      playSfx('select');
      this.bubble(0, '¡CINCO!');
      this.log('Gritas «¡CINCO!». Camilo aplaude.');
      this.dirty = true;
    } else {
      this.bubble(0, '¿Cinco?');
      this.log('Gritas «¡Cinco!» sin motivo. Todos te miran. Sira se ríe.');
    }
  }

  // -------------------------------------------------------------------------
  // Jugadas
  // -------------------------------------------------------------------------

  private resolvePlay(who: number, card: Card, color: Color): void {
    const seat = this.seats[who];
    this.pile.push({ ...card, color: card.kind === 'comodin' || card.kind === 'aguacero' ? color : card.color });
    this.color = color;
    playSfx('carta');
    this.flyCard(who, card);
    this.dirty = true;
    const name = who === 0 ? 'Tiras' : `${seat.name} tira`;
    this.log(`${name} ${this.describe(card, color)}.`);

    if (seat.hand.length === 0) {
      this.win(who);
      return;
    }
    // Quedó con una carta: ¿gritó «¡Cinco!»?
    if (seat.hand.length === 1) {
      if (who !== 0 && Math.random() < seat.memory) {
        seat.called = true;
        this.bubble(who, this.pick(seat.quips.cinco));
        playSfx('select');
      }
      if (!seat.called) {
        this.cincoCheck = { who, ms: 0, aiCatchAt: who === 0 ? 900 + Math.random() * 1200 : 99999 };
      }
    } else {
      seat.called = false;
    }

    let skip = 0;
    const next = this.nextSeat(who);
    if (card.kind === 'quieto') {
      skip = 1;
      this.bubble(next, '¡Ay!');
    } else if (card.kind === 'patras') {
      this.dir = this.dir === 1 ? -1 : 1;
    } else if (card.kind === 'mas2' || card.kind === 'aguacero') {
      const n = card.kind === 'mas2' ? 2 : 4;
      this.give(next, n);
      skip = 1;
      if (who !== 0) this.bubble(who, this.pick(seat.quips.attack));
      if (next !== 0) this.bubble(next, this.pick(this.seats[next].quips.hit));
      else this.bubble(0, n === 4 ? '¡¿CUATRO?!' : '¡Noo!');
      if (card.kind === 'aguacero') this.banner(`¡AGUACERO!\n${this.seats[next].name === 'Tú' ? 'Robas' : this.seats[next].name + ' roba'} cuatro`, 1100);
    } else if (card.kind === 'num' && card.num === 5) {
      this.startMesa(who);
    }
    this.endTurn(who, skip);
  }

  private endTurn(who: number, skip = 0): void {
    this.drewThisTurn = false;
    this.turn = this.nextSeat(who, 1 + skip);
    this.aiWait = Phaser.Math.Between(AI_DELAY[0], AI_DELAY[1]);
    this.busy = 250;
    this.dirty = true;
  }

  private aiTurn(who: number): void {
    const seat = this.seats[who];
    let options = seat.hand.filter((c) => this.playable(c));
    if (options.length === 0) {
      seat.hand.push(this.draw());
      playSfx('carta');
      this.log(`${seat.name} roba una.`);
      this.dirty = true;
      options = seat.hand.filter((c) => this.playable(c));
      if (options.length === 0) {
        this.endTurn(who);
        return;
      }
    }
    const next = this.nextSeat(who);
    const nextFew = this.seats[next].hand.length <= 2;
    // Sira no le tira +2 ni Aguacero al chileno si puede evitarlo (discreción ante todo).
    const kind = (c: Card): number => {
      if (who === 3 && next === 0 && (c.kind === 'mas2' || c.kind === 'aguacero')) return -5;
      if (c.kind === 'aguacero') return nextFew ? 6 : -2;
      if (c.kind === 'comodin') return -1;
      if (c.kind === 'mas2') return nextFew ? 5 : 2;
      if (c.kind === 'quieto') return nextFew ? 4 : 1;
      if (c.kind === 'patras') return 1;
      return c.color === this.color ? 3 : 2;
    };
    options.sort((a, b) => kind(b) - kind(a) + (Math.random() - 0.5) * 0.5);
    const card = options[0];
    seat.hand.splice(seat.hand.indexOf(card), 1);
    const color = card.color ?? this.bestColor(seat.hand);
    this.resolvePlay(who, card, color);
  }

  private bestColor(hand: Card[]): Color {
    const count = [0, 0, 0, 0];
    for (const c of hand) if (c.color !== null) count[c.color]++;
    let best = 0;
    for (let i = 1; i < 4; i++) if (count[i] > count[best]) best = i;
    return best as Color;
  }

  // -------------------------------------------------------------------------
  // «¡Cinco!» y «¡Mesa!»
  // -------------------------------------------------------------------------

  private updateCincoCheck(delta: number): void {
    const c = this.cincoCheck;
    if (!c) return;
    c.ms += delta;
    if (c.who === 0 && c.ms >= c.aiCatchAt && !this.seats[0].called) {
      // Te pillaron sin gritar.
      const catcher = 1 + Math.floor(Math.random() * 4);
      this.cincoCheck = null;
      playSfx('mesa');
      this.bubble(catcher, '¡No dijo CINCO!');
      this.log(`¡${this.seats[catcher].name} te pilló sin gritar «¡Cinco!»! Robas dos.`);
      this.give(0, 2);
      return;
    }
    if (c.ms >= CINCO_WINDOW) this.cincoCheck = null;
  }

  private startMesa(who: number): void {
    this.mesa = { ms: 0, order: [], ai: [0, 1, 2, 3, 4].map((i) => (i === 0 ? 0 : Phaser.Math.Between(this.seats[i].reflex[0], this.seats[i].reflex[1]))) };
    if (who !== 0) this.mesa.ai[who] = Math.min(this.mesa.ai[who], 220);
    this.banner('¡¡MESA!!\n(E: golpea la mesa)', MESA_WINDOW);
    this.mesaCount++;
  }

  private updateMesa(delta: number): void {
    const m = this.mesa;
    if (!m) return;
    m.ms += delta;
    if (!m.order.includes(0) && Controls.consume('interact')) {
      m.order.push(0);
      playSfx('mesa');
      this.cameras.main.shake(120, 0.006);
      this.bubble(0, '¡PUM!');
    }
    for (let i = 1; i < 5; i++) {
      if (!m.order.includes(i) && m.ms >= m.ai[i]) {
        m.order.push(i);
        playSfx('mesa');
        this.bubble(i, '¡PUM!');
      }
    }
    if (m.order.length === 5 || m.ms >= MESA_WINDOW) {
      for (let i = 0; i < 5; i++) if (!m.order.includes(i)) m.order.push(i);
      const last = m.order[4];
      if (m.order[0] === 0) this.mesaFirst++;
      this.mesa = null;
      this.hideBanner();
      this.log(last === 0 ? '¡Fuiste el último en golpear la mesa! Robas una.' : `${this.seats[last].name} golpeó último. Roba una.`);
      if (last !== 0) this.bubble(last, this.pick(this.seats[last].quips.hit));
      this.give(last, 1);
      this.busy = 500;
    }
    this.dirty = true;
  }

  // -------------------------------------------------------------------------
  // Fin
  // -------------------------------------------------------------------------

  private win(who: number): void {
    this.winner = who;
    this.finished = true;
    playSfx(who === 0 ? 'complete' : 'gol');
    const s = this.seats[who];
    if (who !== 0) this.bubble(who, s.quips.win);
    this.banner(who === 0 ? '¡GANASTE!\n\n(E para seguir)' : `¡Ganó ${s.name}!\n«${s.quips.win}»\n\n(E para seguir)`, 999_999);
    this.dirty = true;
  }

  private finish(): void {
    if (!this.finished) return;
    this.finished = false;
    const result: CincoResult = { winner: this.winner, mesaPerfecta: this.mesaCount > 0 && this.mesaFirst === this.mesaCount };
    StoryState.setFlag('m5_cinco_terminado');
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.done(result));
  }

  // -------------------------------------------------------------------------
  // Textos
  // -------------------------------------------------------------------------

  private describe(c: Card, color: Color): string {
    const col = COLOR_NAMES[color];
    switch (c.kind) {
      case 'num':
        return `un ${c.num} ${col}`;
      case 'quieto':
        return `un «¡Quieto!» ${col}`;
      case 'patras':
        return `un «¡Pa'trás!» ${col}`;
      case 'mas2':
        return `un +2 ${col}`;
      case 'comodin':
        return `un comodín (pide ${col})`;
      case 'aguacero':
        return `¡un AGUACERO! (pide ${col})`;
    }
  }

  private describeTop(): string {
    const t = this.top();
    if (t.kind === 'num') return `un ${t.num} ${COLOR_NAMES[this.color]}`;
    return `${this.describe(t, this.color).replace(/^un /, '')}`;
  }

  private log(text: string): void {
    this.logText.setText(text);
  }

  private pick<T>(list: T[]): T {
    return list[Math.floor(Math.random() * list.length)];
  }

  /** Globito de diálogo junto a un jugador. */
  private bubble(who: number, text: string): void {
    if (!text) return;
    const s = this.seats[who];
    const bx = Phaser.Math.Clamp(s.x, 46, BASE_WIDTH - 46);
    const by = who === 0 ? 124 : who === 1 || who === 4 ? s.y - 26 : s.y + 26;
    const t = this.addText(bx, by, text, { fontSize: '8px', fontStyle: '600', color: THEME.ink, align: 'center', wordWrap: { width: 90 } }).setOrigin(0.5).setDepth(16);
    const g = this.add.graphics().setDepth(15);
    drawPanel(g, Math.round(bx - t.width / 2 - 4), Math.round(by - t.height / 2 - 3), Math.round(t.width + 8), Math.round(t.height + 6), { radius: 4, shadow: false });
    this.tweens.add({
      targets: [t, g],
      alpha: 0,
      delay: 1400,
      duration: 400,
      onComplete: () => (t.destroy(), g.destroy()),
    });
  }

  private banner(text: string, ms: number): void {
    this.bannerText.setText(text);
    const w = Math.min(260, this.bannerText.width + 22);
    const h = this.bannerText.height + 14;
    this.bannerBg.clear();
    drawPanel(this.bannerBg, Math.round(BASE_WIDTH / 2 - w / 2), Math.round(82 - h / 2), Math.round(w), Math.round(h), { radius: 6 });
    this.bannerBg.setVisible(true);
    this.bannerText.setVisible(true);
    this.bannerMs = ms;
  }

  private hideBanner(): void {
    this.bannerBg.setVisible(false);
    this.bannerText.setVisible(false);
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private drawTable(): void {
    const g = this.table;
    // Muro de ladrillo arriba y la mesa larga de madera de Pance Burger.
    for (let y = 0; y < 12; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < BASE_WIDTH; x += 8) g.fillStyle(0xa8503a, 1).fillRect(x, y, 7, 3);
    g.fillStyle(0xc8a890, 1).fillRect(0, 12, BASE_WIDTH, 1);
    g.fillStyle(0x7c4c28, 1).fillRect(0, 13, BASE_WIDTH, BASE_HEIGHT - 13);
    g.fillStyle(0xa87040, 1).fillRect(8, 40, BASE_WIDTH - 16, 112);
    for (let y = 44; y < 150; y += 9) g.fillStyle(0x9a6438, 1).fillRect(8, y, BASE_WIDTH - 16, 1);
    g.fillStyle(0xc8905c, 1).fillRect(8, 40, BASE_WIDTH - 16, 2);
    // Las canastas de papas criollas y las salsas.
    for (const [x, y] of [[60, 58], [250, 120]] as const) {
      g.fillStyle(0xd84848, 1).fillRect(x, y, 16, 10);
      g.fillStyle(0xf0c030, 1).fillCircle(x + 4, y + 3, 2.5).fillCircle(x + 9, y + 4, 2.5).fillCircle(x + 12, y + 2, 2.5);
    }
    g.fillStyle(0xd83838, 1).fillRect(244, 50, 4, 9);
    g.fillStyle(0xf0c030, 1).fillRect(250, 50, 4, 9);
    // Bombillos colgando.
    for (let x = 20; x < BASE_WIDTH; x += 40) {
      g.fillStyle(0x3a3028, 1).fillRect(x - 20, 13, 40, 1);
      g.fillStyle(0xf8d878, 1).fillCircle(x, 16, 2);
    }
  }

  private render(): void {
    this.dirty = false;
    this.ui.removeAll(true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.ui.add(o);
      return o;
    };

    // Retratos y cartas (de espaldas) de los rivales.
    for (let i = 1; i < 5; i++) {
      const s = this.seats[i];
      const g = add(this.add.graphics());
      this.drawPortrait(g, s.look, s.x, s.y, this.turn === i && !this.finished);
      const n = s.hand.length;
      const vertical = i === 1 || i === 4;
      const shown = Math.min(n, 9);
      for (let k = 0; k < shown; k++) {
        const off = (k - (shown - 1) / 2) * 3;
        const cx = vertical ? s.x + (i === 1 ? 20 : -20) : s.x + off;
        const cy = vertical ? s.y + off : s.y + 20;
        this.drawBack(g, cx - 5, cy - 7, 10, 14);
      }
      const label = `${s.name} · ${n}${s.called && n === 1 ? ' ¡CINCO!' : ''}`;
      const ty = vertical ? s.y + 26 : s.y - 20;
      add(this.addText(Phaser.Math.Clamp(s.x, 36, BASE_WIDTH - 36), Math.max(1, ty), label, { fontFamily: FONT_HUD, fontSize: '7px', color: this.turn === i ? '#f8e070' : '#f4e8d8', stroke: '#2a1a12', strokeThickness: 3 }).setOrigin(0.5, 0));
    }

    // Mazo y mesa.
    const g = add(this.add.graphics());
    for (let k = 0; k < 3; k++) this.drawBack(g, DECK.x - CW / 2 + k, DECK.y - CH / 2 - k, CW, CH);
    add(this.addText(DECK.x + 1, DECK.y + CH / 2 + 2, `${this.deck.length}`, { fontFamily: FONT_HUD, fontSize: '7px', color: '#f4e8d8' }).setOrigin(0.5, 0));
    // El color que manda: un halo alrededor de la carta de la mesa.
    g.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS[this.color]).color, 0.5).fillRoundedRect(PILE.x - CW / 2 - 4, PILE.y - CH / 2 - 4, CW + 8, CH + 8, 5);
    const prev = this.pile[this.pile.length - 2];
    if (prev) this.drawCard(g, prev, PILE.x - CW / 2 + 3, PILE.y - CH / 2 + 2, prev.color ?? 0, false, add);
    this.drawCard(g, this.top(), PILE.x - CW / 2, PILE.y - CH / 2, this.color, false, add);
    // Sentido del juego.
    g.lineStyle(1, 0xf4e8d8, 0.7).strokeCircle(152, 66, 34);
    const a = this.time.now / 1000;
    for (let k = 0; k < 3; k++) {
      const ang = a * this.dir * -1 + (k * Math.PI * 2) / 3;
      g.fillStyle(0xf4e8d8, 0.9).fillCircle(152 + Math.cos(ang) * 34, 66 + Math.sin(ang) * 34, 1.5);
    }

    // Tu mano.
    const hand = this.seats[0].hand;
    const n = hand.length;
    const span = Math.min(BASE_WIDTH - 40, n * (CW + 2));
    const step = n > 1 ? Math.min(CW + 2, (span - CW) / (n - 1)) : 0;
    const x0 = BASE_WIDTH / 2 - ((n - 1) * step + CW) / 2;
    hand.forEach((c, i) => {
      const selected = i === this.sel && this.turn === 0 && !this.choosing && !this.finished;
      const ok = this.turn === 0 && this.playable(c);
      const y = HAND_Y - (selected ? 7 : ok && this.turn === 0 ? 2 : 0);
      if (i === this.sel) return;
      this.drawCard(g, c, x0 + i * step, y, c.color ?? 0, !ok && this.turn === 0, add);
    });
    if (n > 0) {
      const c = hand[this.sel];
      const ok = this.turn === 0 && this.playable(c);
      const selY = HAND_Y - (this.turn === 0 && !this.finished ? 7 : 0);
      const cg = add(this.add.graphics());
      this.drawCard(cg, c, x0 + this.sel * step, selY, c.color ?? 0, !ok && this.turn === 0, add);
      if (this.turn === 0) cg.lineStyle(1, 0xf8e070, 1).strokeRoundedRect(x0 + this.sel * step - 1, selY - 1, CW + 2, CH + 2, 3);
    }
    if (this.seats[0].called && n === 1) add(this.addText(BASE_WIDTH / 2, HAND_Y - 16, '¡CINCO!', { fontSize: '9px', fontStyle: '600', color: '#f8e070', stroke: '#2a1a12', strokeThickness: 3 }).setOrigin(0.5));

    // Elegir color del comodín.
    if (this.choosing) {
      const pg = add(this.add.graphics());
      drawPanel(pg, 92, 54, 136, 44, { radius: 5 });
      add(this.addText(160, 58, 'Color del comodín', { fontSize: '8px', fontStyle: '600', color: THEME.ink }).setOrigin(0.5, 0));
      for (let k = 0; k < 4; k++) {
        const x = 104 + k * 30;
        pg.fillStyle(0x2a2433, 1).fillRoundedRect(x - 1, 71, 22, 20, 3);
        pg.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS[k]).color, 1).fillRoundedRect(x, 72, 20, 18, 3);
        if (k === this.choosing.color) pg.lineStyle(2, 0x2a2433, 1).strokeRoundedRect(x - 3, 69, 26, 24, 4);
      }
    }

    this.turnText.setText(this.finished ? '' : this.turn === 0 ? (this.choosing ? '' : this.drewThisTurn ? 'TU TURNO · tira una o W para pasar' : 'TU TURNO') : `Turno de ${this.seats[this.turn].name}`);
    this.turnText.setY(this.choosing ? 120 : 104);
  }

  /** Retrato: cabeza y hombros vistos de frente (como en las viñetas), con un borde si es su turno. */
  private drawPortrait(g: Phaser.GameObjects.Graphics, look: HumanLook, cx: number, cy: number, active: boolean): void {
    const hex = (c: string): number => Phaser.Display.Color.HexStringToColor(c).color;
    if (active) g.fillStyle(0xf8e070, 0.35).fillCircle(cx, cy, 14);
    g.fillStyle(0x2a2433, 1).fillRect(cx - 9, cy + 4, 18, 9);
    g.fillStyle(hex(look.shirt), 1).fillRect(cx - 8, cy + 5, 16, 8);
    if (look.hairStyle === 'long') g.fillStyle(hex(look.hair), 1).fillRect(cx - 7, cy - 6, 14, 13);
    g.fillStyle(0x2a2433, 1).fillRect(cx - 6, cy - 8, 12, 13);
    g.fillStyle(hex(look.skin), 1).fillRect(cx - 5, cy - 7, 10, 11);
    if (look.hairStyle === 'cap') {
      g.fillStyle(hex(look.cap ?? '#d84848'), 1).fillRect(cx - 6, cy - 9, 12, 4).fillRect(cx - 7, cy - 6, 14, 1);
    } else if (look.hairStyle !== 'bald') {
      g.fillStyle(hex(look.hair), 1).fillRect(cx - 6, cy - 9, 12, 4);
      if (look.hairStyle === 'bun') g.fillRect(cx - 2, cy - 12, 4, 3);
    }
    g.fillStyle(0x202028, 1).fillRect(cx - 3, cy - 3, 1, 2).fillRect(cx + 2, cy - 3, 1, 2);
    if (look.extras?.includes('glasses')) {
      // Marco fino: arriba y abajo de cada ojo, y el puente.
      g.fillStyle(0x202028, 1).fillRect(cx - 5, cy - 5, 4, 1).fillRect(cx - 5, cy - 1, 4, 1).fillRect(cx + 1, cy - 5, 4, 1).fillRect(cx + 1, cy - 1, 4, 1).fillRect(cx - 1, cy - 4, 2, 1);
    }
    if (look.extras?.includes('beard')) {
      g.fillStyle(hex(look.hair), 1).fillRect(cx - 5, cy + 2, 10, 2).fillRect(cx - 5, cy, 1, 2).fillRect(cx + 4, cy, 1, 2);
      g.fillStyle(0xe8a0a0, 1).fillRect(cx - 1, cy + 1, 3, 1);
    }
    else g.fillStyle(0x8a3a3a, 1).fillRect(cx - 1, cy + 1, 3, 1);
    g.fillStyle(0xe8a0a0, 1).fillRect(cx - 4, cy - 1, 1, 1).fillRect(cx + 3, cy - 1, 1, 1);
  }

  private drawBack(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(0x2a2433, 1).fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
    g.fillStyle(0xf4f0e6, 1).fillRoundedRect(x, y, w, h, 2);
    g.fillStyle(0x2a2433, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle(0xe84848, 1).fillCircle(x + w / 2, y + h / 2, Math.min(w, h) / 4);
    g.fillStyle(0xf0c030, 1).fillRect(x + w / 2 - 1, y + h / 2 - 1, 2, 2);
  }

  /** Carta de frente: color, número o símbolo dibujado (comodín en cuatro colores, Aguacero con gotas). */
  private drawCard(
    g: Phaser.GameObjects.Graphics,
    c: Card,
    x: number,
    y: number,
    color: number,
    dim: boolean,
    add: <T extends Phaser.GameObjects.GameObject>(o: T) => T,
  ): void {
    x = Math.round(x);
    y = Math.round(y);
    g.fillStyle(0x2a2433, 1).fillRoundedRect(x - 1, y - 1, CW + 2, CH + 2, 3);
    g.fillStyle(0xf8f6ee, 1).fillRoundedRect(x, y, CW, CH, 3);
    const wild = c.kind === 'comodin' || c.kind === 'aguacero';
    if (wild) {
      for (let k = 0; k < 4; k++) g.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS[k]).color, 1).fillRect(x + 2 + (k % 2) * 9, y + 2 + Math.floor(k / 2) * 14, 9, 14);
      g.fillStyle(0x2a2433, 1).fillEllipse(x + CW / 2, y + CH / 2, 14, 18);
    } else {
      g.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS[color]).color, 1).fillRect(x + 2, y + 2, CW - 4, CH - 4);
      g.fillStyle(0xf8f6ee, 1).fillEllipse(x + CW / 2, y + CH / 2, 15, 22);
    }
    const ink = wild ? '#f8f6ee' : COLORS[color];
    let label = '';
    if (c.kind === 'num') label = String(c.num);
    else if (c.kind === 'mas2') label = '+2';
    else if (c.kind === 'aguacero') label = '+4';
    if (label) {
      add(this.addText(x + CW / 2, y + CH / 2, label, { fontSize: c.kind === 'num' ? '13px' : '10px', fontStyle: '700', color: ink, stroke: '#2a2433', strokeThickness: 2 }).setOrigin(0.5));
      if (c.kind === 'num') {
        add(this.addText(x + 3, y + 1, label, { fontSize: '7px', fontStyle: '700', color: '#f8f6ee' }));
        if (c.num === 5) g.fillStyle(0xf8e070, 1).fillRect(x + CW - 6, y + 3, 3, 3);
      }
    }
    const cx = x + CW / 2;
    const cy = y + CH / 2;
    const col = Phaser.Display.Color.HexStringToColor(COLORS[color]).color;
    if (c.kind === 'quieto') {
      g.lineStyle(2, col, 1).strokeCircle(cx, cy, 5);
      g.lineBetween(cx - 4, cy + 4, cx + 4, cy - 4);
    } else if (c.kind === 'patras') {
      g.fillStyle(col, 1).fillTriangle(cx - 6, cy - 3, cx - 1, cy - 7, cx - 1, cy + 1).fillRect(cx - 1, cy - 4, 6, 2);
      g.fillStyle(col, 1).fillTriangle(cx + 6, cy + 3, cx + 1, cy - 1, cx + 1, cy + 7).fillRect(cx - 5, cy + 2, 6, 2);
    } else if (c.kind === 'comodin') {
      g.fillStyle(0xf0c030, 1).fillCircle(cx - 2, cy - 3, 2).fillStyle(0x2f6fd0, 1).fillCircle(cx + 2, cy - 3, 2);
      g.fillStyle(0xe84848, 1).fillCircle(cx - 2, cy + 2, 2).fillStyle(0x3cae5c, 1).fillCircle(cx + 2, cy + 2, 2);
    } else if (c.kind === 'aguacero') {
      for (const [dx, dy] of [[-4, -9], [3, -7], [-1, 6], [4, 8]] as const) g.fillStyle(0x9cd8ff, 1).fillRect(cx + dx, cy + dy, 1, 2);
    }
    if (dim) g.fillStyle(0x000000, 0.35).fillRoundedRect(x, y, CW, CH, 3);
  }

  /** Una carta que vuela de la mano de alguien a la mesa. */
  private flyCard(who: number, card: Card): void {
    const s = this.seats[who];
    const from = who === 0 ? { x: BASE_WIDTH / 2, y: HAND_Y + 10 } : { x: s.x, y: s.y };
    const g = this.add.graphics().setDepth(9);
    const tmp: Phaser.GameObjects.GameObject[] = [];
    this.drawCard(g, card, -CW / 2, -CH / 2, this.color, false, (o) => {
      tmp.push(o);
      return o;
    });
    for (const o of tmp) o.destroy();
    g.setPosition(from.x, from.y).setScale(0.6).setAngle(Phaser.Math.Between(-30, 30));
    this.tweens.add({
      targets: g,
      x: PILE.x,
      y: PILE.y,
      scale: 1,
      angle: 0,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => g.destroy(),
    });
  }
}
