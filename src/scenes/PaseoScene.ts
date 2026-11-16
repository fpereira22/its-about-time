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
 * Misión 10 (prefijo m11_): los juegos del paseo a La Vorágine y la Chorrera del Indio con Laura, y las hamburguesas
 * de esa noche en el 805. Cada modo tiene su mecánica:
 *  - `trocha`: el segundo Uber, de La Vorágine a San Francisco por la vía destapada. Vas atrás, entre Fiorella y
 *    Laura. Cuando el bache llega a la marca, W para agarrarte (si no, te das contra el techo); en las curvas, A/D.
 *  - `salto`: tirarse al pozo del río desde las piedras. La barra va y viene: E cuando esté en lo hondo. Tres saltos,
 *    el último de la mano con Laura, en el «hiru» de su cuenta.
 *  - `cascada`: debajo de la Chorrera del Indio. El chorro te empuja: A/D para quedarte debajo sin soltarle la mano.
 *  - `mano`: cruzar el río por las piedras, de la mano. W avanza, A/D al lado. Las piedras con ondas se mueven.
 *  - `subida`: el cerro hasta el mirador. Aparece una tecla (W/A/S/D): apriétala a tiempo. Con «E», le das la mano.
 *  - `bajada`: de bajada, de la mano, con el sol yéndose. S en el barro para frenar; A/D para esquivar las piedras.
 *  - `burger`: las hamburguesas del 805. Aplastar la carne (E en el grosor justo), darlas vuelta en la plancha
 *    (A/D elige, E voltea) y armarlas en el orden de la receta.
 */

export type PaseoMode = 'trocha' | 'salto' | 'cascada' | 'mano' | 'subida' | 'bajada' | 'burger';

export interface PaseoResult {
  mode: PaseoMode;
  /** Lo que se cuenta en cada modo (baches tomados, saltos al pozo, segundos bajo el chorro, piedras...). */
  score: number;
  /** Bien hecho. */
  good: boolean;
  /** Sin un solo error. */
  perfect: boolean;
  skipped: boolean;
  /** Laura no te soltó la mano (cascada, mano, subida, bajada) o se agarró de tu brazo (trocha). */
  together: boolean;
}

export interface PaseoSceneData {
  mode: PaseoMode;
  done: (r: PaseoResult) => void;
}

const INTROS: Record<PaseoMode, { title: string; text: string; hint: string; bg: string }> = {
  trocha: {
    title: 'La Vorágine → San Francisco · la trocha',
    text: 'El conductor: «Agárrense, que de aquí pa\'rriba la vía es destapada.»\nVas atrás, al medio, entre Fiorella y Laura. Danilo adelante.\nW cuando el bache llegue a la marca · A/D en las curvas.',
    hint: 'W: agarrarse en el bache · A/D: compensar la curva · Esc: saltar',
    bg: '#2a3a24',
  },
  salto: {
    title: 'El pozo del río Pance',
    text: 'Danilo: «El que no se tira, no almuerza.»\nLa barra va y viene: E cuando esté en lo hondo (verde).\nEl tercero es de a dos.',
    hint: 'E: saltar · Esc: saltar el juego',
    bg: '#2c5a3c',
  },
  cascada: {
    title: 'Debajo de la Chorrera del Indio',
    text: 'Laura: «Vale. Debajo. Los dos. Y no me sueltes, ¿eh?»\nEl chorro te empuja para los lados: A/D para quedarte debajo.\nSi te alejas mucho de Laura, se sueltan.',
    hint: 'A/D: mantenerse debajo del chorro · Esc: salir',
    bg: '#1c3a3c',
  },
  mano: {
    title: 'El paso de las piedras',
    text: 'Laura: «Por ahí no paso yo sola ni loca. Dame la mano.»\nW: avanzar · A/D: de lado. Las piedras con ondas se mueven.\nTres resbalones y se mojan enteros.',
    hint: 'W: avanzar · A/D: al lado · Esc: saltar',
    bg: '#1c4a54',
  },
  subida: {
    title: 'La subida al mirador',
    text: 'El sendero se pone empinado. Laura va detrás.\nAprieta la tecla que aparece (W/A/S/D) antes de que se acabe.\nCuando Laura pida la mano: E.',
    hint: 'W/A/S/D: el paso que aparece · E: darle la mano · Esc: saltar',
    bg: '#3a5a2c',
  },
  bajada: {
    title: 'La bajada, con el sol yéndose',
    text: 'Bajan de la mano. El sendero está mojado.\nS en el barro para frenar · A/D para esquivar las piedras.',
    hint: 'S: frenar en el barro · A/D: esquivar · Esc: saltar',
    bg: '#5a3c4c',
  },
  burger: {
    title: 'Hamburguesas del 805',
    text: 'Solo tienes carne molida, pan, queso, tomate y una lechuga valiente.\nAplasta la carne (E en el grosor justo), vuélteala a tiempo (A/D · E)\ny ármala en el orden de la receta.',
    hint: 'E: aplastar / voltear · A/D: elegir · Esc: saltar',
    bg: '#3a2a24',
  },
};

function look(id: string, fallback: HumanLook): HumanLook {
  return (characterLook(id) as HumanLook | undefined) ?? fallback;
}

const KEYS = ['up', 'left', 'down', 'right'] as const;
type Key = (typeof KEYS)[number];
const KEY_LABEL: Record<Key, string> = { up: 'W', left: 'A', down: 'S', right: 'D' };
const KEY_COLOR: Record<Key, number> = { up: 0x58b858, left: 0x4a9ad8, down: 0xe8903c, right: 0xe8607a };

/** Lo que se pone en la hamburguesa, en orden de abajo hacia arriba. */
const RECETA = ['pan', 'lechuga', 'carne', 'queso', 'tomate', 'pan'] as const;
type Capa = (typeof RECETA)[number];
const CAPA_KEY: Record<Capa, Key> = { pan: 'up', lechuga: 'left', carne: 'down', queso: 'right', tomate: 'left' };
const CAPA_COLOR: Record<Capa, number> = { pan: 0xd8a050, lechuga: 0x58b848, carne: 0x6a3c24, queso: 0xf8d040, tomate: 0xd83c30 };

export class PaseoScene extends MiniScene<PaseoResult> {
  private mode: PaseoMode = 'trocha';
  private phase: 'intro' | 'play' | 'end' = 'intro';
  private score = 0;
  private misses = 0;
  private skipped = false;
  private good = false;
  private perfect = false;
  private together = true;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private bigText!: Phaser.GameObjects.Text;
  private me!: HumanLook;
  private laura!: HumanLook;
  private t = 0;

  // Trocha
  private baches: Array<{ kind: 'bache' | 'izq' | 'der'; at: number; done: boolean }> = [];
  private grabMs = 0;
  private lean = 0;
  private leanV = 0;
  private bumpFx = 0;
  private lauraGrab = false;

  // Salto
  private jump = 0;
  private bar = 0;
  private barDir = 1;
  private flying = 0;
  private landed: 'hondo' | 'bajito' | null = null;
  private count = 0;

  // Cascada
  private pos = 0;
  private vel = 0;
  private push = 0;
  private pushTimer = 0;
  private held = 0;
  private apart = 0;

  // Mano
  private stones: Array<{ x: number; y: number; wobbly: boolean }> = [];
  private col = 2;
  private row = 0;
  private slips = 0;
  private slipFx = 0;

  // Subida
  private prompt: Key | 'mano' | null = null;
  private promptMs = 0;
  private promptMax = 0;
  private climbed = 0;
  private handsGiven = 0;
  private gaveHand = 0;

  // Bajada
  private obstacles: Array<{ kind: 'barro' | 'piedra'; lane: number; y: number; hit: boolean }> = [];
  private lane = 1;
  private spawnMs = 0;
  private braking = false;
  private dist = 0;
  private sunset = 0;

  // Burger
  private bStep: 'aplastar' | 'plancha' | 'armar' = 'aplastar';
  private patties: Array<{ cook: number; side: 0 | 1; flipped: number; done: boolean; burnt: boolean }> = [];
  private press = 0;
  private pressDir = 1;
  private pressed = 0;
  private sel = 0;
  private stack: Capa[] = [];
  private bWait = 0;

  constructor() {
    super('Paseo');
  }

  init(data: PaseoSceneData): void {
    this.initMini(data.done);
    this.mode = data.mode;
    this.phase = 'intro';
    this.score = 0;
    this.misses = 0;
    this.skipped = false;
    this.good = false;
    this.perfect = false;
    this.together = true;
    this.t = 0;
    // Trocha: doce baches y cuatro curvas, repartidos en el camino.
    this.baches = [];
    let at = 2.2;
    const kinds: Array<'bache' | 'izq' | 'der'> = ['bache', 'bache', 'izq', 'bache', 'bache', 'der', 'bache', 'bache', 'bache', 'izq', 'bache', 'bache', 'der', 'bache', 'bache', 'bache'];
    for (const kind of kinds) {
      this.baches.push({ kind, at, done: false });
      at += kind === 'bache' ? 1.5 + Math.random() * 0.9 : 2.6;
    }
    this.grabMs = 0;
    this.lean = 0;
    this.leanV = 0;
    this.bumpFx = 0;
    this.lauraGrab = false;
    // Salto
    this.jump = 0;
    this.bar = 0;
    this.barDir = 1;
    this.flying = 0;
    this.landed = null;
    this.count = 0;
    // Cascada
    this.pos = 0;
    this.vel = 0;
    this.push = 0;
    this.pushTimer = 1.2;
    this.held = 0;
    this.apart = 0;
    // Mano: ocho filas de piedras, tres o cuatro por fila; algunas se mueven.
    this.stones = [];
    for (let r = 1; r <= 8; r++) {
      for (let c = 0; c < 5; c++) {
        if ((r * 7 + c * 3) % 5 === 0) continue;
        this.stones.push({ x: c, y: r, wobbly: (r * 5 + c * 11) % 4 === 0 });
      }
    }
    this.col = 2;
    this.row = 0;
    this.slips = 0;
    this.slipFx = 0;
    // Subida
    this.prompt = null;
    this.promptMs = 0;
    this.promptMax = 0;
    this.climbed = 0;
    this.handsGiven = 0;
    this.gaveHand = 0;
    // Bajada
    this.obstacles = [];
    this.lane = 1;
    this.spawnMs = 0.8;
    this.braking = false;
    this.dist = 0;
    this.sunset = 0;
    // Burger
    this.bStep = 'aplastar';
    this.patties = [];
    this.press = 0;
    this.pressDir = 1;
    this.pressed = 0;
    this.sel = 0;
    this.stack = [];
    this.bWait = 0;
  }

  create(): void {
    this.me = playerLook();
    this.laura = look(this.mode === 'trocha' || this.mode === 'subida' || this.mode === 'bajada' ? 'laura' : 'laura_bano', this.me);
    if (this.mode === 'burger') this.laura = look('laura', this.me);
    this.g = this.add.graphics();
    this.hud = this.add.graphics().setDepth(40);
    const intro = INTROS[this.mode];
    this.createUi(intro.bg);
    this.infoText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', fontStyle: '600', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);
    this.bigText = this.addText(BASE_WIDTH / 2, 26, '', { fontSize: '10px', fontStyle: '700', color: '#f8e070', stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(52);
    this.titleText.setText(intro.title);
    this.hintText.setText(intro.hint);
    playMusic(this.mode === 'burger' ? 'cocina' : this.mode === 'trocha' ? 'carro_danilo' : this.mode === 'bajada' ? 'recuerdo' : 'rio');
    this.banner(`${intro.text}\n(E para empezar)`);
  }

  override update(_time: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    const dt = Math.min(delta, 40) / 1000;
    if (this.phase === 'intro') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        this.phase = 'play';
        if (this.mode === 'subida') this.nextPrompt();
      }
    } else if (this.phase === 'play') {
      this.t += dt;
      if (Controls.consume('menu')) {
        this.skipped = true;
        this.endGame('Lo dejas ahí. Laura: «Vale, vale... otra vez será.»');
      } else if (this.mode === 'trocha') this.playTrocha(dt);
      else if (this.mode === 'salto') this.playSalto(dt);
      else if (this.mode === 'cascada') this.playCascada(dt);
      else if (this.mode === 'mano') this.playMano(dt);
      else if (this.mode === 'subida') this.playSubida(dt);
      else if (this.mode === 'bajada') this.playBajada(dt);
      else this.playBurger(dt);
    } else if (this.phase === 'end') {
      if (Controls.consume('interact')) {
        this.finish({ mode: this.mode, score: this.score, good: this.good, perfect: this.perfect, skipped: this.skipped, together: this.together });
      }
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
  // Trocha
  // -------------------------------------------------------------------------

  private playTrocha(dt: number): void {
    if (Controls.consume('up')) this.grabMs = 0.28;
    this.grabMs = Math.max(0, this.grabMs - dt);
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    // Las curvas empujan el cuerpo hacia afuera.
    let force = 0;
    for (const e of this.baches) {
      if (e.kind === 'bache') continue;
      const k = (this.t - e.at) / 1.6;
      if (k > 0 && k < 1) force += Math.sin(k * Math.PI) * (e.kind === 'izq' ? 1 : -1) * 1.1;
    }
    this.leanV += (force * 2.4 + input * 2.6 - this.lean * 1.4) * dt;
    this.leanV *= 1 - 2.2 * dt;
    this.lean = Phaser.Math.Clamp(this.lean + this.leanV * dt, -1.2, 1.2);
    this.bumpFx = Math.max(0, this.bumpFx - dt * 3);

    for (const e of this.baches) {
      if (e.done) continue;
      if (e.kind === 'bache' && this.t >= e.at) {
        e.done = true;
        if (this.grabMs > 0) {
          this.score++;
          this.float('¡Agarrado!', '#a8e0a0', BASE_WIDTH / 2, 70);
          playSfx('bump');
        } else {
          this.misses++;
          this.bumpFx = 1;
          playSfx('golpe');
          this.float('¡Pum! El techo', '#ff9c9c', BASE_WIDTH / 2, 70);
          const lines = ['Fiorella: «¡Ay, causa, mi cabeza!»', 'Laura: «¡Hostia! ¿Estás bien?»', 'Danilo: «¡Ve, chileno, agarrate!»', 'El conductor: «Eso no es nada, mijo. Espere la de arriba.»'];
          this.say(lines[this.misses % lines.length], BASE_WIDTH / 2, 40, 1400);
        }
        // A la mitad del camino, Laura se agarra de tu brazo y ya no se suelta.
        if (!this.lauraGrab && this.baches.indexOf(e) >= 7) {
          this.lauraGrab = true;
          this.say('Laura se agarra de tu brazo. «Perdón... no te suelto, ¿vale? Por si acaso.»', 230, 40, 2600);
        }
      } else if (e.kind !== 'bache' && this.t >= e.at + 1.6) {
        e.done = true;
        if (Math.abs(this.lean) < 0.75) this.score++;
        else {
          this.misses++;
          playSfx('golpe');
          this.say(this.lean < 0 ? 'Fiorella: «¡Chileno, que me sacas por la ventana!»' : 'Laura: «Que me aplastas, tío... bueno, no tanto.»', BASE_WIDTH / 2, 40, 1300);
        }
      }
    }
    const next = this.baches.find((e) => !e.done);
    this.bigText.setText(next ? (next.kind === 'bache' ? '' : next.kind === 'izq' ? '⟵ curva' : 'curva ⟶') : '');
    this.infoText.setText(`Baches: ${this.score}  ·  Golpes: ${this.misses}`);
    if (!next) {
      this.together = this.lauraGrab;
      this.good = this.misses <= 4;
      this.perfect = this.misses === 0;
      this.endGame(
        this.perfect
          ? 'Ni un golpe. El conductor: «Usted nació en un campero, mijo.» Laura no te ha soltado el brazo.'
          : this.good
            ? 'Llegan a San Francisco con la cabeza más o menos entera. Laura sigue agarrada de tu brazo. No dice nada. Tú tampoco.'
            : 'Llegas con un chichón y Fiorella con dos. Laura te sopla la frente: «Pobre. Ya está, ya está.»',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Salto
  // -------------------------------------------------------------------------

  private playSalto(dt: number): void {
    if (this.flying > 0) {
      this.flying -= dt;
      if (this.flying <= 0) this.afterJump();
      return;
    }
    const speed = 1.1 + this.jump * 0.35;
    this.bar += this.barDir * speed * dt;
    if (this.bar > 1) {
      this.bar = 1;
      this.barDir = -1;
    } else if (this.bar < 0) {
      this.bar = 0;
      this.barDir = 1;
    }
    const zone = this.zone();
    if (this.jump === 2) {
      // El de a dos: Laura cuenta en euskera y hay que saltar en el «hiru».
      this.count += dt;
      const words = ['Bat...', 'Bi...', '¡HIRU!'];
      const i = Math.min(2, Math.floor(this.count / 0.9));
      this.bigText.setText(`Laura: ${words[i]}`);
      if (this.count > 3.6) {
        this.count = 0;
        this.say('Laura: «Que no has saltado, tonto. Otra vez.»', 230, 50, 1200);
      }
      if (Controls.consume('interact')) {
        const onTime = this.count >= 1.8 && this.count < 2.9;
        this.landed = onTime ? 'hondo' : 'bajito';
        this.flying = 1;
        playSfx('salto');
      }
      return;
    }
    this.bigText.setText(`Salto ${this.jump + 1} de 3`);
    if (Controls.consume('interact')) {
      this.landed = this.bar >= zone.a && this.bar <= zone.b ? 'hondo' : 'bajito';
      this.flying = 1;
      playSfx('salto');
    }
  }

  /** Lo hondo del pozo (verde) se achica en cada salto. */
  private zone(): { a: number; b: number } {
    const w = [0.3, 0.2, 0.3][this.jump];
    const c = [0.55, 0.62, 0.5][this.jump];
    return { a: c - w / 2, b: c + w / 2 };
  }

  private afterJump(): void {
    playSfx('chapuzon');
    if (this.landed === 'hondo') {
      this.score++;
      const lines = [
        'Danilo: «¡Eso, chileno! ¡Bautizado en el Pance!»',
        'Ariana: «¡Asu, de más arriba! Estás loco, causa.»',
        'Salen los dos a flote al mismo tiempo, todavía de la mano. Laura se ríe con el pelo en la cara.',
      ];
      this.say(lines[this.jump], BASE_WIDTH / 2, 50, 2200);
    } else {
      this.misses++;
      if (this.jump === 2) this.together = false;
      this.say(this.jump === 2 ? 'Saltan descoordinados. Laura: «¡Que era en el hiru! ¡Hiru es tres!»' : 'Caes en lo bajito. Pies raspados. Mila: «Uy, eso dolió hasta acá.»', BASE_WIDTH / 2, 50, 2200);
    }
    this.jump++;
    this.count = 0;
    this.landed = null;
    if (this.jump >= 3) {
      this.good = this.score >= 2;
      this.perfect = this.score === 3;
      this.endGame(
        this.perfect
          ? 'Tres de tres al pozo. Y el último de la mano. El agua está helada y a ninguno de los dos le importa.'
          : this.good
            ? `${this.score} de 3 al pozo. Danilo: «Aprobado. Puede almorzar.»`
            : 'Más raspones que saltos. Fiorella te pasa una curita que nadie sabe de dónde sacó.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Cascada
  // -------------------------------------------------------------------------

  private playCascada(dt: number): void {
    const DUR = 18;
    this.pushTimer -= dt;
    if (this.pushTimer <= 0) {
      this.push = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.9);
      this.pushTimer = 0.9 + Math.random() * 1.1;
    }
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    this.vel += (this.push * 1.6 + input * 2.4 - this.pos * 0.4) * dt;
    this.vel *= 1 - 2.4 * dt;
    this.pos = Phaser.Math.Clamp(this.pos + this.vel * dt, -1.3, 1.3);
    const under = Math.abs(this.pos) < 0.45;
    if (under) this.held += dt;
    if (Math.abs(this.pos) > 0.95) {
      this.apart += dt;
      if (this.apart > 0.6 && this.together) {
        this.together = false;
        playSfx('chapuzon');
        this.say('El chorro te arrastra y se sueltan. Laura te busca con la mano: «¡Ven aquí!»', BASE_WIDTH / 2, 40, 1800);
      }
    } else this.apart = 0;
    if (!this.together && under && this.held > 6 && Math.abs(this.pos) < 0.2) {
      this.together = true;
      this.say('Le vuelves a agarrar la mano. No se sueltan más.', BASE_WIDTH / 2, 40, 1600);
    }
    if (Math.floor(this.t) === 8 && Math.floor(this.t - dt) === 7) this.say('Laura grita algo que el agua no deja oír. Se ríe. Tú también.', BASE_WIDTH / 2, 40, 1800);
    this.bigText.setText(under ? '' : this.pos < 0 ? 'te vas a la izquierda →' : '← te vas a la derecha');
    this.infoText.setText(`Debajo: ${Math.floor(this.held)} s  ·  ${Math.max(0, Math.ceil(DUR - this.t))} s`);
    if (this.t >= DUR) {
      this.score = Math.floor(this.held);
      this.good = this.score >= 10;
      this.perfect = this.score >= 15 && this.together;
      this.endGame(
        this.perfect
          ? 'Salen temblando, morados y de la mano. Laura: «Esto no lo cuento en Bakio. No me lo van a creer.»'
          : this.good
            ? 'Aguantas debajo de la Chorrera. Laura sale primero y te espera en la piedra, castañeteando.'
            : 'El agua gana. Sales tosiendo. Laura: «Vale, el Indio uno, chileno cero.»',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Mano (las piedras)
  // -------------------------------------------------------------------------

  private stoneAt(c: number, r: number): { x: number; y: number; wobbly: boolean } | undefined {
    return this.stones.find((s) => s.x === c && s.y === r);
  }

  private playMano(dt: number): void {
    this.slipFx = Math.max(0, this.slipFx - dt * 2);
    let tc = this.col;
    let tr = this.row;
    if (Controls.consume('up')) tr++;
    else if (Controls.consume('left')) tc--;
    else if (Controls.consume('right')) tc++;
    else if (Controls.consume('down')) tr = Math.max(0, tr - 1);
    else return;
    tc = Phaser.Math.Clamp(tc, 0, 4);
    if (tr === this.row && tc === this.col) return;
    if (tr >= 9) {
      this.row = 9;
      this.finishMano();
      return;
    }
    const st = tr === 0 ? { x: tc, y: 0, wobbly: false } : this.stoneAt(tc, tr);
    if (!st) {
      this.bigText.setText('Ahí no hay piedra');
      playSfx('bump');
      return;
    }
    this.col = tc;
    this.row = tr;
    this.bigText.setText('');
    playSfx('cursor');
    if (st.wobbly) {
      this.slips++;
      this.slipFx = 1;
      st.wobbly = false;
      playSfx('chapuzon');
      const lines = ['Se mueve la piedra. Laura te aprieta la mano: «¡Hostia, hostia!»', 'Otro resbalón. Quedan mojados hasta la rodilla. Laura se ríe de nervios.', 'Al agua los dos. Salen empapados... y todavía de la mano.'];
      this.say(lines[Math.min(2, this.slips - 1)], BASE_WIDTH / 2, 30, 1800);
      if (this.slips >= 3) this.together = false;
    } else if (this.row === 4) this.say('Laura: «No mires abajo. Mírame a mí. ...Vale, a mí tampoco, que me pongo nerviosa.»', BASE_WIDTH / 2, 30, 2000);
    this.infoText.setText(`Fila ${this.row}/8  ·  Resbalones: ${this.slips}`);
  }

  private finishMano(): void {
    this.score = 8 - this.slips;
    this.good = this.slips <= 2;
    this.perfect = this.slips === 0;
    this.together = this.slips < 3;
    this.endGame(
      this.perfect
        ? 'Cruzan sin mojarse. En la otra orilla, Laura no te suelta la mano. Tú tampoco haces el intento.'
        : this.good
          ? 'Cruzan con los pies mojados. Laura: «Eso ha sido trabajo en equipo. Equipo... ¿ves?»'
          : 'Llegan empapados. Mila, desde la orilla: «¿Eso era un paso o un bautizo?»',
    );
  }

  // -------------------------------------------------------------------------
  // Subida
  // -------------------------------------------------------------------------

  private nextPrompt(): void {
    const needHand = (this.climbed === 6 || this.climbed === 13 || this.climbed === 19) && this.gaveHand < this.climbed;
    if (needHand) {
      this.gaveHand = this.climbed;
      this.prompt = 'mano';
      this.promptMax = 1.6;
      this.say('Laura: «¿Me ayudas? Aquí no llego.» (E)', 230, 40, 1500);
    } else {
      this.prompt = KEYS[Math.floor(Math.random() * KEYS.length)];
      this.promptMax = Math.max(0.7, 1.4 - this.climbed * 0.03);
    }
    this.promptMs = this.promptMax;
  }

  private playSubida(dt: number): void {
    const GOAL = 24;
    this.promptMs -= dt;
    const p = this.prompt;
    let hit: boolean | null = null;
    if (p === 'mano') {
      if (Controls.consume('interact')) hit = true;
      else for (const k of KEYS) if (Controls.consume(k)) hit = false;
    } else if (p) {
      for (const k of KEYS) if (Controls.consume(k)) hit = k === p;
      if (Controls.consume('interact')) hit = false;
    }
    if (hit === null && this.promptMs <= 0) hit = false;
    if (hit !== null) {
      if (hit) {
        this.climbed++;
        if (p === 'mano') {
          this.handsGiven++;
          playSfx('latido');
          this.float('♥', '#ff8aa8', 200, 90);
        } else playSfx('cursor');
      } else {
        this.misses++;
        if (p === 'mano') this.say('Laura sube sola, a como puede. «Vale, gracias, ¿eh?»', 230, 40, 1400);
        else {
          this.climbed = Math.max(0, this.climbed - 1);
          playSfx('bump');
          this.float('resbalón', '#ff9c9c', 140, 100);
        }
      }
      if (this.climbed >= GOAL) {
        this.score = this.climbed;
        this.together = this.handsGiven >= 2;
        this.good = this.misses <= 5;
        this.perfect = this.misses === 0;
        this.endGame(
          this.perfect
            ? 'Arriba. Todo el valle del Pance a los pies, y Cali allá lejos. Laura no dice nada. Te apoya la cabeza en el hombro.'
            : this.good
              ? 'Llegan al mirador sin aire. Laura: «Merece la pena. Esto... y lo otro.» ¿Qué otro? No lo explica.'
              : 'Llegan arrastrándose. Danilo ya está arriba hace rato, comiéndose una mandarina.',
        );
        return;
      }
      this.nextPrompt();
    }
    this.infoText.setText(`Subida: ${Math.round((this.climbed / GOAL) * 100)}%  ·  Manos: ${this.handsGiven}`);
    this.bigText.setText(this.prompt === 'mano' ? '¡E: la mano!' : '');
  }

  // -------------------------------------------------------------------------
  // Bajada
  // -------------------------------------------------------------------------

  private playBajada(dt: number): void {
    const DIST = 60;
    if (Controls.consume('left')) this.lane = Math.max(0, this.lane - 1);
    if (Controls.consume('right')) this.lane = Math.min(2, this.lane + 1);
    this.braking = Controls.isHeld('down');
    const speed = this.braking ? 22 : 34;
    this.dist += (speed / 10) * dt;
    this.sunset = Math.min(1, this.dist / DIST);
    this.spawnMs -= dt;
    if (this.spawnMs <= 0) {
      this.obstacles.push({ kind: Math.random() < 0.55 ? 'barro' : 'piedra', lane: Math.floor(Math.random() * 3), y: 30, hit: false });
      this.spawnMs = 1.1 + Math.random() * 0.8;
    }
    const PY = 132;
    for (const o of this.obstacles) {
      o.y += speed * dt * 2.4;
      if (!o.hit && o.y > PY - 6 && o.y < PY + 6 && o.lane === this.lane) {
        o.hit = true;
        if (o.kind === 'piedra') {
          this.misses++;
          playSfx('golpe');
          this.say('Tropiezas. Laura te sujeta: «¡Ey! Que te tengo.»', BASE_WIDTH / 2, 40, 1300);
        } else if (!this.braking) {
          this.misses++;
          playSfx('chapuzon');
          this.say('Patinas en el barro y se van los dos al suelo. Se ríen hasta que les duele.', BASE_WIDTH / 2, 40, 1600);
        } else {
          this.score++;
          this.float('¡Frenado!', '#a8e0a0', 160, 110);
        }
      } else if (!o.hit && o.y > PY + 6) {
        o.hit = true;
        if (o.kind === 'piedra' || o.lane !== this.lane) this.score++;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.y < BASE_HEIGHT + 20);
    if (Math.floor(this.dist) === 30 && Math.floor(this.dist - (speed / 10) * dt) === 29) {
      this.say('Laura: «¿Sabes qué? Hoy ha sido de los mejores días desde que llegué. Y no lo digo por el río.»', BASE_WIDTH / 2, 40, 2800);
    }
    this.infoText.setText(`Bajada: ${Math.round(this.sunset * 100)}%  ·  Caídas: ${this.misses}`);
    if (this.dist >= DIST) {
      this.good = this.misses <= 3;
      this.perfect = this.misses === 0;
      this.together = this.misses <= 3;
      this.endGame(
        this.perfect
          ? 'Abajo, con el último sol. No se han soltado la mano en todo el camino. Nadie del grupo comenta nada. Todos lo vieron.'
          : this.good
            ? 'Llegan abajo con barro hasta las rodillas, de la mano. Fiorella: «Uy, uy, uy...» Mila le pega un codazo.'
            : 'Llegan abajo enteros, más o menos. Laura: «Tienes barro hasta en las cejas.» Te lo limpia con el pulgar.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Burger
  // -------------------------------------------------------------------------

  private playBurger(dt: number): void {
    if (this.bWait > 0) {
      this.bWait -= dt;
      return;
    }
    if (this.bStep === 'aplastar') {
      this.press += this.pressDir * 1.3 * dt;
      if (this.press > 1) {
        this.press = 1;
        this.pressDir = -1;
      } else if (this.press < 0) {
        this.press = 0;
        this.pressDir = 1;
      }
      this.bigText.setText(`Carne ${this.pressed + 1} de 2: E en el grosor justo`);
      if (Controls.consume('interact')) {
        const ok = this.press > 0.42 && this.press < 0.62;
        if (ok) {
          this.score++;
          this.float('¡Justa!', '#a8e0a0', 160, 100);
        } else {
          this.misses++;
          this.float(this.press < 0.42 ? 'Muy gorda' : 'Muy delgada', '#ff9c9c', 160, 100);
        }
        playSfx('sarten');
        this.patties.push({ cook: 0, side: 0, flipped: 0, done: false, burnt: false });
        this.pressed++;
        if (this.pressed >= 2) {
          this.bStep = 'plancha';
          this.bWait = 0.6;
        }
      }
      return;
    }
    if (this.bStep === 'plancha') {
      this.bigText.setText('A/D: elegir · E: voltear cuando esté dorada');
      if (Controls.consume('left')) this.sel = 0;
      if (Controls.consume('right')) this.sel = 1;
      for (const p of this.patties) {
        if (p.done) continue;
        p.cook += dt * 0.22;
        if (p.cook > 1.25 && !p.burnt) {
          p.burnt = true;
          this.misses++;
          this.say('Huele a quemado. Abres la ventana. Nadie tiene por qué enterarse.', BASE_WIDTH / 2, 40, 1500);
        }
      }
      if (Controls.consume('interact')) {
        const p = this.patties[this.sel];
        if (!p.done) {
          playSfx('sarten');
          const ok = p.cook > 0.7 && p.cook < 1.1;
          if (ok) {
            this.score++;
            this.float('¡Dorada!', '#a8e0a0', this.sel === 0 ? 120 : 200, 90);
          } else if (!p.burnt) {
            this.misses++;
            this.float(p.cook <= 0.7 ? 'Cruda todavía' : 'Pasada', '#ff9c9c', this.sel === 0 ? 120 : 200, 90);
          }
          if (p.side === 0) {
            p.side = 1;
            p.cook = 0;
          } else p.done = true;
        }
      }
      if (this.patties.every((p) => p.done)) {
        this.bStep = 'armar';
        this.bWait = 0.6;
      }
      return;
    }
    // Armar: la receta, capa por capa.
    const want = RECETA[this.stack.length];
    this.bigText.setText(`Ahora: ${want} (${KEY_LABEL[CAPA_KEY[want]]})`);
    for (const k of KEYS) {
      if (!Controls.consume(k)) continue;
      if (k === CAPA_KEY[want]) {
        this.stack.push(want);
        playSfx('select');
        this.score++;
      } else {
        this.misses++;
        playSfx('error');
        this.float('Esa no va ahí', '#ff9c9c', 160, 80);
      }
      break;
    }
    if (this.stack.length >= RECETA.length) {
      this.good = this.misses <= 3;
      this.perfect = this.misses === 0;
      this.endGame(
        this.perfect
          ? 'Dos hamburguesas que parecen de foto. Simples, pero perfectas. Ojalá le gusten.'
          : this.good
            ? 'Dos hamburguesas honestas. Un poco chuecas. Como uno.'
            : 'Dos hamburguesas... existen. Les pones harto queso encima. El queso lo arregla todo.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private draw(): void {
    const g = this.g;
    g.clear();
    if (this.mode === 'trocha') this.drawTrocha(g);
    else if (this.mode === 'salto') this.drawSalto(g);
    else if (this.mode === 'cascada') this.drawCascada(g);
    else if (this.mode === 'mano') this.drawMano(g);
    else if (this.mode === 'subida') this.drawSubida(g);
    else if (this.mode === 'bajada') this.drawBajada(g);
    else this.drawBurger(g);
    const h = this.hud;
    h.clear();
    this.drawBars(h);
  }

  private face(g: Phaser.GameObjects.Graphics, l: HumanLook, x: number, y: number, s: number, o: BustOpts = {}): void {
    bust(g, l, Math.round(x), Math.round(y), s, o);
  }

  private drawTrocha(g: Phaser.GameObjects.Graphics): void {
    // El parabrisas: la trocha con guaduas y cerros, que se mueve con los baches.
    const shake = this.bumpFx > 0 ? Math.sin(this.t * 60) * 3 * this.bumpFx : 0;
    g.fillStyle(0x7cb8e8, 1).fillRect(0, 0, BASE_WIDTH, 80);
    g.fillStyle(0x4a7a5c, 1).fillTriangle(-20, 70, 80, 20, 180, 70).fillTriangle(120, 70, 240, 14, 360, 70);
    g.fillStyle(0x5aa04a, 1).fillRect(0, 60, BASE_WIDTH, 30);
    g.fillStyle(0x9c7c54, 1).fillTriangle(BASE_WIDTH / 2 - 14, 60, BASE_WIDTH / 2 + 14, 60, BASE_WIDTH / 2 + 90, 92).fillTriangle(BASE_WIDTH / 2 - 14, 60, BASE_WIDTH / 2 - 90, 92, BASE_WIDTH / 2 + 90, 92);
    // Baches que se acercan por la trocha.
    for (const e of this.baches) {
      if (e.kind !== 'bache' || e.done) continue;
      const k = 1 - (e.at - this.t) / 2;
      if (k < 0 || k > 1) continue;
      const y = 60 + k * 30;
      g.fillStyle(0x5a4028, 1).fillEllipse(BASE_WIDTH / 2 + Math.sin(e.at) * 20 * k, y, 6 + k * 22, 2 + k * 5);
    }
    // La marca: cuando el bache llega aquí, W.
    g.lineStyle(1, 0xf8e070, 0.9).lineBetween(BASE_WIDTH / 2 - 60, 90, BASE_WIDTH / 2 + 60, 90);
    // El techo, el marco y el tablero.
    g.fillStyle(0x2a2a30, 1).fillRect(0, 0, BASE_WIDTH, 8).fillRect(0, 0, 10, 96).fillRect(BASE_WIDTH - 10, 0, 10, 96);
    g.fillStyle(0x3a3a44, 1).fillRect(0, 92, BASE_WIDTH, BASE_HEIGHT - 92);
    // Danilo adelante (de espaldas: el pelo y los hombros) y el conductor.
    g.fillStyle(0x1c1418, 1).fillCircle(110, 98, 12);
    g.fillStyle(0xf4f0e6, 1).fillRect(96, 106, 28, 12);
    g.fillStyle(0x3a2418, 1).fillCircle(210, 98, 12);
    g.fillStyle(0x2c64c0, 1).fillRect(196, 106, 28, 12);
    // Atrás: Fiorella, tú y Laura.
    const lean = this.lean * 18;
    const by = 140 + shake;
    const fio = look('fiorella', this.me);
    this.face(g, fio, 90 + Math.min(0, lean) * 0.6, by, 3, this.bumpFx > 0.5 ? { mouth: 'o' } : { mouth: 'smile' });
    this.face(g, this.me, 160 + lean, by - (this.grabMs > 0 ? 2 : 0), 3.2, this.bumpFx > 0.5 ? { mouth: 'o', eyes: 'closed' } : { mouth: 'smile' });
    this.face(g, this.laura, 230 + Math.max(0, lean) * 0.6, by, 3, this.lauraGrab ? { mouth: 'smile', blush: true } : this.bumpFx > 0.5 ? { mouth: 'o' } : { mouth: 'grin' });
    if (this.lauraGrab) g.fillStyle(0xf8e2d4, 1).fillRect(186 + lean, by + 26, 22, 4);
    // La manilla del techo (W).
    g.fillStyle(this.grabMs > 0 ? 0xf8e070 : 0x8c8c94, 1).fillRect(150 + lean, 10, 20, 4);
  }

  private drawSalto(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x7cb8e8, 1).fillRect(0, 0, BASE_WIDTH, 70);
    g.fillStyle(0x3c8040, 1).fillRect(0, 40, BASE_WIDTH, 40);
    for (let i = 0; i < 12; i++) g.fillStyle(0x2c6a34, 1).fillCircle(i * 30, 44 + (i % 3) * 4, 16);
    // El pozo: de lo bajito (claro) a lo hondo (oscuro).
    g.fillStyle(0x6cc0c8, 1).fillRect(110, 110, 210, 60);
    g.fillStyle(0x2a7c94, 1).fillRect(170, 112, 150, 56);
    g.fillStyle(0x1c5a74, 1).fillRect(200, 116, 90, 48);
    // Las piedras desde donde se salta (más alto en cada salto).
    const rockTop = [100, 80, 100][Math.min(2, this.jump)];
    g.fillStyle(0x6c6c64, 1).fillRect(0, rockTop, 110, BASE_HEIGHT - rockTop);
    g.fillStyle(0x8c8c84, 1).fillRect(0, rockTop, 110, 6);
    // El que salta (y Laura, en el tercero).
    const fly = this.flying > 0 ? 1 - this.flying : 0;
    const land = this.landed === 'hondo' ? 240 : 150;
    const x = 80 + (land - 80) * fly;
    const y = rockTop - 14 - Math.sin(fly * Math.PI) * 40 + fly * 60;
    if (fly < 0.98) {
      this.face(g, this.me, x, y, 2.4, this.flying > 0 ? { mouth: 'open' } : { mouth: 'grin' });
      if (this.jump === 2) {
        this.face(g, this.laura, x - 22, y + 2, 2.4, this.flying > 0 ? { mouth: 'open', eyes: 'closed' } : { mouth: 'smile' });
        g.fillStyle(0xf8e2d4, 1).fillRect(x - 14, y + 18, 10, 3);
      }
    }
    // La barra (no en el de a dos: ahí manda la cuenta).
    if (this.jump < 2 && this.phase === 'play') {
      const zone = this.zone();
      const bx = 20;
      const bw = 280;
      g.fillStyle(0x14182a, 0.8).fillRect(bx - 2, 22, bw + 4, 10);
      g.fillStyle(0x8c8c84, 1).fillRect(bx, 24, bw * 0.3, 6);
      g.fillStyle(0x6cc0c8, 1).fillRect(bx + bw * 0.3, 24, bw * 0.7, 6);
      g.fillStyle(0x58c858, 1).fillRect(bx + bw * zone.a, 24, bw * (zone.b - zone.a), 6);
      g.fillStyle(0xf8e070, 1).fillRect(bx + bw * this.bar - 1, 20, 3, 14);
    }
    // Los amigos en la orilla.
    for (const [id, px] of [['danilo_bano', 30], ['mila_bano', 56]] as const) this.face(g, look(id, this.me), px, rockTop - 30, 1.6, { mouth: 'grin' });
  }

  private drawCascada(g: Phaser.GameObjects.Graphics): void {
    // La roca negra y la Chorrera del Indio bajando de lo alto.
    g.fillStyle(0x2a2c30, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let i = 0; i < 20; i++) g.fillStyle(0x3a3c40, 1).fillRect((i * 47) % BASE_WIDTH, (i * 31) % 120, 30, 18);
    g.fillStyle(0x2c6a34, 1).fillRect(0, 0, BASE_WIDTH, 12);
    const cx = BASE_WIDTH / 2;
    g.fillStyle(0xe8f4f8, 0.9).fillRect(cx - 26, 0, 52, 150);
    for (let i = 0; i < 18; i++) g.fillStyle(0xbfe0ec, 1).fillRect(cx - 24 + ((i * 7 + Math.floor(this.t * 40)) % 48), (i * 23 + this.t * 200) % 150, 2, 10);
    // El pozo y la espuma.
    g.fillStyle(0x2a7c94, 1).fillRect(0, 140, BASE_WIDTH, BASE_HEIGHT - 140);
    g.fillStyle(0xf4f8fc, 0.8).fillEllipse(cx, 142, 120 + Math.sin(this.t * 8) * 6, 12);
    // Tú y Laura, de la mano (o no).
    const px = cx + this.pos * 70;
    const lx = this.together ? px + 26 : cx + 60;
    this.face(g, this.me, px, 118, 2.6, Math.abs(this.pos) < 0.45 ? { mouth: 'o', eyes: 'closed' } : { mouth: 'open' });
    this.face(g, this.laura, lx, 120, 2.6, this.together ? { mouth: 'grin', eyes: 'closed' } : { mouth: 'o' });
    if (this.together) g.fillStyle(0xf8e2d4, 1).fillRect(px + 10, 140, 8, 3);
  }

  private drawMano(g: Phaser.GameObjects.Graphics): void {
    // El río de arriba abajo, visto desde arriba; la otra orilla arriba.
    g.fillStyle(0x2a7c94, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let i = 0; i < 40; i++) g.fillStyle(0xe8f8f4, 0.5).fillRect((i * 37 + this.t * 30) % BASE_WIDTH, (i * 23) % BASE_HEIGHT, 8, 1);
    g.fillStyle(0x3c8040, 1).fillRect(0, 14, BASE_WIDTH, 12);
    g.fillStyle(0xb8ae9c, 1).fillRect(0, 150, BASE_WIDTH, 30);
    const cell = (c: number, r: number): [number, number] => [100 + c * 30, 150 - r * 14];
    for (const s of this.stones) {
      const [x, y] = cell(s.x, s.y);
      g.fillStyle(0x14182a, 1).fillEllipse(x, y, 22, 11);
      g.fillStyle(0x9c968c, 1).fillEllipse(x, y - 1, 20, 9);
      if (s.wobbly) g.lineStyle(1, 0xe8f8f4, 0.7).strokeEllipse(x, y, 26 + Math.sin(this.t * 6) * 3, 13);
    }
    const [px, py] = cell(this.col, Math.min(this.row, 9));
    const ly = py + 14;
    g.fillStyle(this.slipFx > 0 ? 0x9cd0f0 : 0x2c64c0, 1).fillCircle(px, py - 4, 6);
    g.fillStyle(0x3a2418, 1).fillCircle(px, py - 6, 4);
    g.fillStyle(0xc8303c, 1).fillCircle(px + 6, ly - 4, 6);
    g.fillStyle(0x7a4c2c, 1).fillCircle(px + 6, ly - 6, 4);
    if (this.together) g.lineStyle(2, 0xf8e2d4, 1).lineBetween(px + 2, py, px + 5, ly - 6);
  }

  private drawSubida(g: Phaser.GameObjects.Graphics): void {
    const k = this.climbed / 24;
    g.fillStyle(0x7cb8e8, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    g.fillStyle(0x9cc8a0, 1).fillTriangle(-40, 160, 120, 40 - k * 20, 300, 160);
    g.fillStyle(0x5a8c4c, 1).fillTriangle(60, 180, 240, 30 + (1 - k) * 30, 380, 180);
    // El sendero en zigzag y los dos subiendo.
    g.lineStyle(3, 0xa07c54, 1);
    for (let i = 0; i < 6; i++) g.lineBetween(120 + (i % 2) * 80, 170 - i * 22, 200 - (i % 2) * 80, 170 - (i + 1) * 22);
    const y = 160 - k * 110;
    const x = 160 + Math.sin(k * 12) * 40;
    this.face(g, this.me, x, y, 2, { mouth: this.prompt === 'mano' ? 'open' : 'smile' });
    this.face(g, this.laura, x - 14, y + 18, 2, { mouth: this.handsGiven > 0 ? 'smile' : 'o', blush: this.handsGiven > 1 });
    // La tecla que hay que apretar.
    if (this.prompt && this.phase === 'play') {
      const w = (this.promptMs / Math.max(0.1, this.promptMax)) * 40;
      const color = this.prompt === 'mano' ? 0xf8a0b8 : KEY_COLOR[this.prompt];
      g.fillStyle(0x14182a, 0.85).fillRoundedRect(BASE_WIDTH - 70, 40, 56, 48, 6);
      g.fillStyle(color, 1).fillRoundedRect(BASE_WIDTH - 62, 46, 40, 28, 4);
      g.fillStyle(0xf8e070, 1).fillRect(BASE_WIDTH - 62, 80, w, 3);
      this.bigText.setText(this.prompt === 'mano' ? '¡E: la mano!' : KEY_LABEL[this.prompt]).setPosition(BASE_WIDTH - 42, 60);
    }
  }

  private drawBajada(g: Phaser.GameObjects.Graphics): void {
    // El cielo pasa de la tarde al atardecer mientras bajan.
    const s = this.sunset;
    const sky = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x7cb8e8),
      Phaser.Display.Color.ValueToColor(0xe8806a),
      100,
      Math.round(s * 100),
    );
    g.fillStyle(Phaser.Display.Color.GetColor(sky.r, sky.g, sky.b), 1).fillRect(0, 0, BASE_WIDTH, 60);
    g.fillStyle(0xf8e070, 1).fillCircle(260, 20 + s * 36, 10);
    g.fillStyle(0x3c6a3c, 1).fillRect(0, 50, BASE_WIDTH, BASE_HEIGHT - 50);
    // El sendero de tres carriles, con las piedras y el barro bajando hacia ti.
    g.fillStyle(0x8c6a44, 1).fillRect(100, 50, 120, BASE_HEIGHT - 50);
    for (let i = 0; i < 10; i++) g.fillStyle(0x7a5a38, 1).fillRect(104 + ((i * 37) % 110), 52 + ((i * 29 + this.dist * 30) % 120), 6, 2);
    const laneX = (l: number): number => 120 + l * 40;
    for (const o of this.obstacles) {
      if (o.kind === 'barro') g.fillStyle(0x4a3018, 1).fillEllipse(laneX(o.lane), o.y, 30, 10);
      else {
        g.fillStyle(0x14182a, 1).fillCircle(laneX(o.lane), o.y, 7);
        g.fillStyle(0x9c968c, 1).fillCircle(laneX(o.lane), o.y - 1, 6);
      }
    }
    const px = laneX(this.lane);
    this.face(g, this.me, px, 132, 1.8, { mouth: this.braking ? 'o' : 'smile' });
    this.face(g, this.laura, px + 20, 136, 1.8, { mouth: 'smile', blush: true });
    g.fillStyle(0xf8e2d4, 1).fillRect(px + 8, 146, 6, 2);
  }

  private drawBurger(g: Phaser.GameObjects.Graphics): void {
    // La cocina del 805: el mesón, la plancha y la ventana con Cali de noche.
    g.fillStyle(0xe8dcc8, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    g.fillStyle(0x141c34, 1).fillRect(220, 20, 90, 50);
    for (let i = 0; i < 20; i++) g.fillStyle(0xf8dc68, 0.8).fillRect(222 + ((i * 17) % 86), 40 + ((i * 7) % 28), 1, 1);
    g.fillStyle(0x8c6a48, 1).fillRect(0, 110, BASE_WIDTH, BASE_HEIGHT - 110);
    if (this.bStep === 'aplastar') {
      const h = 6 + (1 - this.press) * 22;
      g.fillStyle(0x14182a, 1).fillEllipse(160, 120, 60 + this.press * 30, h + 2);
      g.fillStyle(0xb85848, 1).fillEllipse(160, 119, 58 + this.press * 30, h);
      // La barra del grosor.
      g.fillStyle(0x14182a, 0.8).fillRect(60, 30, 200, 10);
      g.fillStyle(0x58c858, 1).fillRect(60 + 200 * 0.42, 32, 200 * 0.2, 6);
      g.fillStyle(0xf8e070, 1).fillRect(60 + 200 * this.press - 1, 28, 3, 14);
    } else if (this.bStep === 'plancha') {
      g.fillStyle(0x2a2a30, 1).fillRect(70, 96, 180, 40);
      this.patties.forEach((p, i) => {
        const x = 120 + i * 80;
        const c = p.burnt ? 0x1c1414 : p.cook > 0.7 ? 0x6a3c24 : p.cook > 0.35 ? 0x8c4c34 : 0xb85848;
        if (this.sel === i) g.lineStyle(2, 0xf8e070, 1).strokeEllipse(x, 112, 54, 20);
        g.fillStyle(c, 1).fillEllipse(x, 112, 46, 14);
        if (!p.done) for (let k = 0; k < 3; k++) g.fillStyle(0xffffff, 0.35).fillCircle(x - 10 + k * 10, 100 - ((this.t * 20 + k * 7) % 14), 2);
        g.fillStyle(0x14182a, 0.8).fillRect(x - 24, 140, 48, 5);
        g.fillStyle(p.cook > 0.7 && p.cook < 1.1 ? 0x58c858 : 0xe8903c, 1).fillRect(x - 24, 140, 48 * Math.min(1, p.cook / 1.25), 5);
      });
    } else {
      this.stack.forEach((c, i) => {
        g.fillStyle(CAPA_COLOR[c], 1).fillRoundedRect(130, 130 - i * 9, 60, c === 'pan' ? 9 : 6, 3);
      });
      // La receta al lado.
      RECETA.forEach((c, i) => {
        const y = 140 - i * 14;
        const done = i < this.stack.length;
        g.fillStyle(done ? 0x58c858 : 0x14182a, done ? 1 : 0.7).fillRoundedRect(230, y - 6, 70, 12, 3);
        g.fillStyle(CAPA_COLOR[c], 1).fillRect(234, y - 3, 8, 6);
      });
    }
  }
}
