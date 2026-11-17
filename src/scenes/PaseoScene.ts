import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { frameIndex, type HumanLook } from '../art/characters';
import { agua, cielo, cordillera, cuerpo, deBano, guadua, helecho, manos, mixColor, nubes, Particles, roca, selva, tecla, type CuerpoOpts } from '../art/paseo_art';
import { charKey, characterLook, ensureCharacterTexture } from '../art/SpriteRegistry';
import { bust, type BustOpts } from '../art/vinetas_m5';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import type { Direction } from '../types/map';
import { Controls } from '../systems/Controls';
import { playerLook } from '../systems/PlayerLook';
import { MiniScene } from './MiniScene';

/**
 * Misión 10 (prefijo m11_): los juegos del lunes festivo en La Vorágine y la Chorrera del Indio con Laura, y las
 * hamburguesas de esa noche en el 805. Solo usan WASD/flechas y E (se juegan igual con los controles táctiles).
 *  - `patitos`: tirar piedras planas al río en La Vorágine mientras se llena el campero. Elegir la piedra, el
 *    ángulo y la fuerza; Laura dice que su récord en Bakio es siete.
 *  - `trocha`: el campero Willys de La Vorágine a San Francisco. W en el bache (cuando llega a la marca), S para
 *    agacharse de las ramas, A/D en las curvas.
 *  - `salto`: tirarse al pozo. E cuando el aro esté en lo hondo; en el aire, la tecla del truco. El tercero, de la
 *    mano con Laura, en el «hiru» de su cuenta.
 *  - `mano`: cruzar el río por las piedras de la mano. Hay piedras flojas y piedras que se hunden; si Laura se
 *    resbala, E para agarrarla.
 *  - `cascada`: debajo de la Chorrera del Indio. A/D para quedarse debajo del chorro; E cuando Laura grita.
 *  - `trucha`: el estanque de don Efraín. Apuntar, lanzar, esperar la picada (no la mordisqueada) y recoger sin que
 *    se corte el nylon. Dos truchas: el almuerzo.
 *  - `subida`: el sendero al mirador. La tecla que aparece, a tiempo; E cuando Laura pida la mano.
 *  - `bajada`: de bajada, de la mano, con el sol yéndose. S en el barro, A/D para las piedras, W para las raíces.
 *  - `burger`: las hamburguesas del 805. Aplastar, voltear y armar.
 * Esc salta el juego.
 */

export type PaseoMode = 'patitos' | 'trocha' | 'salto' | 'cascada' | 'mano' | 'trucha' | 'subida' | 'bajada' | 'burger';

export interface PaseoResult {
  mode: PaseoMode;
  /** Lo que se cuenta en cada modo (baches, saltos al pozo, segundos bajo el chorro, rebotes, truchas...). */
  score: number;
  /** Bien hecho. */
  good: boolean;
  /** Sin un solo error. */
  perfect: boolean;
  skipped: boolean;
  /** Laura no te soltó la mano (cascada, mano, subida, bajada) o se agarró de tu brazo (trocha). */
  together: boolean;
  /** Patitos: el mejor de Laura. Salto: los trucos que salieron. */
  extra?: number;
}

export interface PaseoSceneData {
  mode: PaseoMode;
  done: (r: PaseoResult) => void;
}

const INTROS: Record<PaseoMode, { title: string; text: string; hint: string; bg: string }> = {
  patitos: {
    title: 'Patitos en el río · La Vorágine',
    text: 'Laura: «En Bakio mi récord es siete. Siete. A ver qué sabe hacer un chileno.»\nElige la piedra (A/D · E), el ángulo (E) y la fuerza (E).\nPlana, bajita y con ganas. Tres tiros cada uno.',
    hint: 'A/D: elegir piedra · E: lanzar · Esc: saltar',
    bg: '#3c7c58',
  },
  trocha: {
    title: 'La Vorágine → San Francisco · la trocha',
    text: 'El conductor: «Agárrense, que de aquí pa\'rriba es pura piedra.»\nVas atrás, entre Fiorella y Laura. Danilo adelante con su sombrero.\nW cuando el bache llegue a la marca · S: agacharse de las ramas · A/D en las curvas.',
    hint: 'W: agarrarse · S: agacharse · A/D: compensar la curva · Esc: saltar',
    bg: '#2a3a24',
  },
  salto: {
    title: 'El pozo del río Pance',
    text: 'Danilo: «El que no se tira, no almuerza.»\nE cuando el aro esté en lo hondo (lo oscuro). En el aire: la tecla del truco.\nEl tercero es de a dos: salta en el «hiru» de Laura.',
    hint: 'E: saltar · W/A/D: el truco en el aire · Esc: saltar el juego',
    bg: '#2c5a3c',
  },
  cascada: {
    title: 'Debajo de la Chorrera del Indio',
    text: 'Laura: «Vale. Debajo. Los dos. Y no me sueltes, ¿eh?»\nEl chorro se carga para un lado (mira las flechas): A/D para quedarte debajo.\nCuando Laura diga «¡grita!», E.',
    hint: 'A/D: debajo del chorro · E: gritar con Laura · Esc: salir',
    bg: '#1c3a3c',
  },
  mano: {
    title: 'El paso de las piedras',
    text: 'Laura: «Por ahí no paso yo sola ni loca. Dame la mano.»\nW: avanzar · A/D: de lado. Las piedras con ondas se mueven; las que se hunden, espéralas.\nSi Laura se resbala: ¡E!',
    hint: 'W: avanzar · A/D: al lado · S: atrás · E: agarrar a Laura · Esc: saltar',
    bg: '#1c4a54',
  },
  trucha: {
    title: 'La truchera de don Efraín',
    text: 'Don Efraín: «La que pesquen, se la fríe doña Ofelia. Las que no, se las comen los gallinazos.»\nWASD apunta y E lanza. Cuando el corcho se HUNDA (no cuando tiembla): E.\nMantén E para recoger; suéltalo si el nylon se pone rojo. Dos truchas.',
    hint: 'WASD: apuntar · E: lanzar / clavar / recoger · Esc: saltar',
    bg: '#24463c',
  },
  subida: {
    title: 'La subida al mirador',
    text: 'El sendero se pone empinado. Laura va detrás.\nAprieta la tecla que aparece (W/A/S/D) antes de que se cierre el aro.\nCuando Laura pida la mano: E.',
    hint: 'W/A/S/D: el paso que aparece · E: darle la mano · Esc: saltar',
    bg: '#3a5a2c',
  },
  bajada: {
    title: 'La bajada, con el sol yéndose',
    text: 'Bajan de la mano. El sendero está mojado.\nS: frenar en el barro · A/D: esquivar las piedras · W: saltar las raíces.',
    hint: 'S: frenar · A/D: esquivar · W: saltar raíz · Esc: saltar',
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

type TrochaEv = { kind: 'bache' | 'izq' | 'der' | 'rama'; at: number; done: boolean };
type Stone = { x: number; y: number; kind: 'firme' | 'floja' | 'hunde'; off: number; used: boolean };
type Obstacle = { kind: 'barro' | 'piedra' | 'raiz'; lane: number; y: number; hit: boolean };
type Fish = { x: number; y: number; vx: number; vy: number; size: number; state: 'nada' | 'viene' | 'pica' | 'huye'; t: number };

/** Laguito del estanque de truchas (en pantalla). */
const POND = { x: 70, y: 46, w: 190, h: 86 };

export class PaseoScene extends MiniScene<PaseoResult> {
  private mode: PaseoMode = 'trocha';
  private phase: 'intro' | 'count' | 'play' | 'end' = 'intro';
  private countT = 0;
  private score = 0;
  private misses = 0;
  private skipped = false;
  private good = false;
  private perfect = false;
  private together = true;
  private extra = 0;
  private bg!: Phaser.GameObjects.Graphics;
  private g!: Phaser.GameObjects.Graphics;
  private fg!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private bigText!: Phaser.GameObjects.Text;
  private keyText!: Phaser.GameObjects.Text;
  private parts = new Particles();
  private me!: HumanLook;
  private meBano!: HumanLook;
  private laura!: HumanLook;
  private t = 0;
  private sprites: Record<string, Phaser.GameObjects.Sprite> = {};

  // Patitos
  private pStep: 'elige' | 'angulo' | 'fuerza' | 'vuela' | 'laura' | 'pausa' = 'elige';
  private pRound = 0;
  private pPick = 0;
  private pAngle = 0;
  private pAngleDir = 1;
  private pPower = 0;
  private pPowerDir = 1;
  private pBest = 0;
  private pLauraBest = 0;
  private pThrow: { x: number; y: number; vx: number; hop: number; hops: number; left: number; z: number; vz: number; who: 'me' | 'laura' } | null = null;
  private pWait = 0;
  private pChosen = { angle: 0, power: 0, flat: 1 };
  private pScores: number[] = [];
  private pLaura: number[] = [];

  // Trocha
  private evs: TrochaEv[] = [];
  private lastGrab = -9;
  private ducking = false;
  private lean = 0;
  private leanV = 0;
  private bumpFx = 0;
  private lauraGrab = false;
  private roadX = 0;

  // Salto
  private jump = 0;
  private sStep: 'apunta' | 'vuelo' | 'agua' | 'cuenta' = 'apunta';
  private ring = 0;
  private ringDir = 1;
  private flyT = 0;
  private landX = 0;
  private deep = false;
  private trick: Key | null = null;
  private trickDone: 'ok' | 'mal' | null = null;
  private tricks = 0;
  private count = 0;
  private waterT = 0;

  // Cascada
  private pos = 0;
  private vel = 0;
  private push = 0;
  private nextPush = 0;
  private pushTimer = 0;
  private held = 0;
  private apart = 0;
  private shout = 0;
  private shouts = 0;
  private shoutAt = [7, 14];

  // Mano
  private stones: Stone[] = [];
  private col = 2;
  private row = 0;
  private lCol = 2;
  private lRow = -1;
  private slips = 0;
  private slipFx = 0;
  private hop = 0;
  private grabQte = 0;
  private qteRows: number[] = [3, 6];

  // Trucha
  private tStep: 'apunta' | 'lanza' | 'espera' | 'pelea' | 'saca' = 'apunta';
  private aim = { x: 165, y: 90 };
  private bob = { x: 165, y: 90, dip: 0, fly: 0, fromX: 0, fromY: 0 };
  private fish: Fish[] = [];
  private hooked: Fish | null = null;
  private tension = 0;
  private line = 1;
  private biteWin = 0;
  private nibbles = 0;
  private caught = 0;
  private lost = 0;
  private tLeft = 80;

  // Subida
  private prompt: Key | 'mano' | null = null;
  private promptMs = 0;
  private promptMax = 0;
  private climbed = 0;
  private handsGiven = 0;
  private gaveHand = 0;
  private restMs = 0;
  private stepFx = 0;

  // Bajada
  private obstacles: Obstacle[] = [];
  private lane = 1;
  private laneX = 160;
  private spawnMs = 0;
  private braking = false;
  private jumping = 0;
  private dist = 0;
  private sunset = 0;

  // Burger
  private bStep: 'aplastar' | 'plancha' | 'armar' = 'aplastar';
  private patties: Array<{ cook: number; side: 0 | 1; done: boolean; burnt: boolean }> = [];
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
    this.countT = 0;
    this.score = 0;
    this.misses = 0;
    this.skipped = false;
    this.good = false;
    this.perfect = false;
    this.together = true;
    this.extra = 0;
    this.t = 0;
    this.parts = new Particles();
    this.sprites = {};
    // Patitos
    this.pStep = 'elige';
    this.pRound = 0;
    this.pPick = 0;
    this.pAngle = 0;
    this.pPower = 0;
    this.pBest = 0;
    this.pLauraBest = 0;
    this.pThrow = null;
    this.pWait = 0;
    this.pScores = [];
    this.pLaura = [];
    // Trocha: catorce baches, cuatro curvas y tres ramas, repartidos en el camino.
    this.evs = [];
    let at = 3;
    const kinds: TrochaEv['kind'][] = ['bache', 'bache', 'izq', 'bache', 'rama', 'bache', 'bache', 'der', 'bache', 'bache', 'rama', 'bache', 'izq', 'bache', 'bache', 'bache', 'der', 'rama', 'bache', 'bache', 'bache'];
    for (const kind of kinds) {
      this.evs.push({ kind, at, done: false });
      at += kind === 'bache' ? 1.3 + Math.random() * 0.9 : kind === 'rama' ? 1.8 : 2.8;
    }
    this.lastGrab = -9;
    this.ducking = false;
    this.lean = 0;
    this.leanV = 0;
    this.bumpFx = 0;
    this.lauraGrab = false;
    this.roadX = 0;
    // Salto
    this.jump = 0;
    this.sStep = 'apunta';
    this.ring = 0;
    this.ringDir = 1;
    this.flyT = 0;
    this.trick = null;
    this.trickDone = null;
    this.tricks = 0;
    this.count = 0;
    this.waterT = 0;
    // Cascada
    this.pos = 0;
    this.vel = 0;
    this.push = 0;
    this.nextPush = Math.random() < 0.5 ? -1 : 1;
    this.pushTimer = 1.6;
    this.held = 0;
    this.apart = 0;
    this.shout = 0;
    this.shouts = 0;
    this.shoutAt = [7, 14];
    // Mano: ocho filas de piedras; algunas flojas y otras que se hunden.
    this.stones = [];
    for (let r = 1; r <= 8; r++) {
      for (let c = 0; c < 5; c++) {
        if ((r * 7 + c * 3) % 5 === 0) continue;
        const k = (r * 5 + c * 11) % 7;
        this.stones.push({ x: c, y: r, kind: k === 0 ? 'floja' : k === 3 ? 'hunde' : 'firme', off: (r * 1.7 + c * 2.3) % 6, used: false });
      }
    }
    this.col = 2;
    this.row = 0;
    this.lCol = 2;
    this.lRow = -1;
    this.slips = 0;
    this.slipFx = 0;
    this.hop = 0;
    this.grabQte = 0;
    this.qteRows = [3, 6];
    // Trucha
    this.tStep = 'apunta';
    this.aim = { x: 165, y: 90 };
    this.bob = { x: 165, y: 90, dip: 0, fly: 0, fromX: 0, fromY: 0 };
    this.fish = [];
    for (let i = 0; i < 7; i++) {
      this.fish.push({ x: POND.x + 20 + Math.random() * (POND.w - 40), y: POND.y + 14 + Math.random() * (POND.h - 28), vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 10, size: 0.8 + Math.random() * 0.5, state: 'nada', t: Math.random() * 3 });
    }
    this.hooked = null;
    this.tension = 0;
    this.line = 1;
    this.biteWin = 0;
    this.nibbles = 0;
    this.caught = 0;
    this.lost = 0;
    this.tLeft = 95;
    // Subida
    this.prompt = null;
    this.promptMs = 0;
    this.promptMax = 0;
    this.climbed = 0;
    this.handsGiven = 0;
    this.gaveHand = 0;
    this.restMs = 0;
    this.stepFx = 0;
    // Bajada
    this.obstacles = [];
    this.lane = 1;
    this.laneX = 160;
    this.spawnMs = 1;
    this.braking = false;
    this.jumping = 0;
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
    this.hudLabels = [];
    this.pKinds = this.shuffleKinds();
    this.standSunk = false;
    this.nibT = 0;
    this.waitT = 0;
    this.surge = 0;
    this.surgeT = 0;
    this.sacaT = 0;
    this.handFx = 0;
  }

  create(): void {
    this.me = playerLook();
    this.meBano = deBano(this.me);
    const lauraId = this.mode === 'salto' || this.mode === 'cascada' || this.mode === 'mano' || this.mode === 'trucha' ? 'laura_bano' : 'laura';
    this.laura = look(lauraId, this.me);
    this.bg = this.add.graphics().setDepth(0);
    this.g = this.add.graphics().setDepth(10);
    this.fg = this.add.graphics().setDepth(25);
    this.fx = this.add.graphics().setDepth(30);
    this.hud = this.add.graphics().setDepth(40);
    const intro = INTROS[this.mode];
    this.createUi(intro.bg);
    this.infoText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', fontStyle: '600', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);
    this.bigText = this.addText(BASE_WIDTH / 2, 26, '', { fontSize: '10px', fontStyle: '700', color: '#f8e070', stroke: '#14182a', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5)
      .setDepth(52);
    this.keyText = this.addText(0, 0, '', { fontSize: '10px', fontStyle: '700', color: '#fbf6ee', stroke: '#14182a', strokeThickness: 2 }).setOrigin(0.5).setDepth(46);
    this.titleText.setText(intro.title);
    this.hintText.setText(intro.hint);
    if (this.mode === 'mano') {
      this.sprites.me = this.mkSprite(this.meBano, 'up');
      this.sprites.laura = this.mkSprite(this.laura, 'up', 'laura_bano');
      ['danilo_bano', 'mila_bano', 'fiorella', 'ariana'].forEach((id, i) => {
        this.sprites[id] = this.mkSprite(look(id, this.me), 'down', id).setPosition(i < 2 ? 30 + i * 24 : 252 + (i - 2) * 24, 34).setScale(1.4);
      });
    }
    if (this.mode === 'bajada') {
      this.sprites.me = this.mkSprite(this.me, 'down').setScale(2.2);
      this.sprites.laura = this.mkSprite(this.laura, 'down', 'laura').setScale(2.2);
    }
    const music = { burger: 'cocina', trocha: 'carro_danilo', bajada: 'recuerdo' } as const;
    playMusic(music[this.mode as keyof typeof music] ?? 'rio');
    this.banner(`${intro.text}\n(E para empezar)`);
  }

  /** Sprite de 16×16 del personaje (la hoja del juego si existe; si no, se genera con su aspecto). */
  private mkSprite(l: HumanLook, dir: Direction, id?: string): Phaser.GameObjects.Sprite {
    let tex = id ? charKey(id) : '';
    if (!id || !this.textures.exists(tex)) {
      tex = `paseo:${l.skin}${l.hair}${l.shirt}${l.pants}${l.shoes ?? ''}${l.hairStyle ?? ''}${l.cap ?? ''}${(l.extras ?? []).join('')}${l.build ?? ''}`;
      ensureCharacterTexture(this.textures, tex, l);
    }
    return this.add.sprite(0, 0, tex, frameIndex(dir, 0)).setOrigin(0.5, 1).setScale(1.6).setDepth(20);
  }

  private walkFrame(s: Phaser.GameObjects.Sprite, dir: Direction, moving: boolean, rate = 8): void {
    const seq: Array<0 | 1 | 2> = [1, 0, 2, 0];
    s.setFrame(frameIndex(dir, moving ? seq[Math.floor(this.t * rate) % 4] : 0));
  }

  override update(_time: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    const dt = Math.min(delta, 40) / 1000;
    this.parts.update(dt);
    if (this.phase === 'intro') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        const counted = ['trocha', 'cascada', 'subida', 'bajada'].includes(this.mode);
        this.phase = counted ? 'count' : 'play';
        this.countT = 0;
        if (!counted) this.onStart();
      }
    } else if (this.phase === 'count') {
      this.countT += dt;
      const n = 3 - Math.floor(this.countT / 0.7);
      this.bigText.setText(n > 0 ? String(n) : '¡YA!').setPosition(BASE_WIDTH / 2, 70).setFontSize(n > 0 ? 18 : 16);
      if (Math.floor(this.countT / 0.7) !== Math.floor((this.countT - dt) / 0.7)) playSfx(n > 0 ? 'blip' : 'select');
      if (this.countT >= 2.6) {
        this.bigText.setText('').setPosition(BASE_WIDTH / 2, 26).setFontSize(10);
        this.phase = 'play';
        this.onStart();
      }
    } else if (this.phase === 'play') {
      this.t += dt;
      if (Controls.consume('menu')) {
        this.skipped = true;
        this.endGame('Lo dejas ahí. Laura: «Vale, vale... otra vez será.»');
      } else this.play(dt);
    } else if (this.phase === 'end') {
      this.t += dt * 0.5;
      if (Controls.consume('interact')) {
        this.finish({ mode: this.mode, score: this.score, good: this.good, perfect: this.perfect, skipped: this.skipped, together: this.together, extra: this.extra });
      }
    }
    this.draw();
  }

  private onStart(): void {
    if (this.mode === 'subida') this.nextPrompt();
  }

  private play(dt: number): void {
    switch (this.mode) {
      case 'patitos':
        return this.playPatitos(dt);
      case 'trocha':
        return this.playTrocha(dt);
      case 'salto':
        return this.playSalto(dt);
      case 'cascada':
        return this.playCascada(dt);
      case 'mano':
        return this.playMano(dt);
      case 'trucha':
        return this.playTrucha(dt);
      case 'subida':
        return this.playSubida(dt);
      case 'bajada':
        return this.playBajada(dt);
      default:
        return this.playBurger(dt);
    }
  }

  private endGame(verdict: string): void {
    this.phase = 'end';
    this.bigText.setText('');
    this.keyText.setText('');
    playSfx(this.good ? 'item' : 'cancel');
    this.banner(`${verdict}\n(E para seguir)`);
  }

  /** Un texto grande que salta y se va (calificación de un intento). */
  private pop(text: string, color: string, x: number, y: number, size = 11): void {
    const t = this.addText(Math.round(x), Math.round(y), text, { fontSize: `${size}px`, fontStyle: '700', color, stroke: '#14182a', strokeThickness: 3 }).setOrigin(0.5).setDepth(56).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, delay: 650, duration: 450, onComplete: () => t.destroy() });
  }

  private face(g: Phaser.GameObjects.Graphics, l: HumanLook, x: number, y: number, s: number, o: BustOpts = {}): void {
    bust(g, l, Math.round(x), Math.round(y), s, o);
  }

  private body(g: Phaser.GameObjects.Graphics, l: HumanLook, x: number, y: number, s: number, o: CuerpoOpts = {}): void {
    cuerpo(g, l, Math.round(x), Math.round(y), s, o);
  }

  /** Barrita con nombre (HUD). */
  private meter(x: number, y: number, w: number, k: number, color: number, label?: string): void {
    const h = this.hud;
    h.fillStyle(0x0c1020, 0.8).fillRoundedRect(x - 2, y - 2, w + 4, 9, 3);
    h.fillStyle(color, 1).fillRect(x, y, Math.max(0, Math.min(1, k)) * w, 5);
    h.lineStyle(1, 0xfbf6ee, 0.5).strokeRect(x, y, w, 5);
    if (label) this.hudLabel(label, x, y - 9);
  }

  private hudLabels: Phaser.GameObjects.Text[] = [];
  private hudLabelIdx = 0;
  private hudLabel(text: string, x: number, y: number): void {
    let t = this.hudLabels[this.hudLabelIdx];
    if (!t) {
      t = this.addText(0, 0, '', { fontSize: '7px', fontStyle: '600', color: '#fbf6ee', stroke: '#0c1020', strokeThickness: 2 }).setDepth(45);
      this.hudLabels.push(t);
    }
    t.setText(text).setPosition(Math.round(x), Math.round(y)).setVisible(true);
    this.hudLabelIdx++;
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private draw(): void {
    for (const gr of [this.bg, this.g, this.fg, this.fx, this.hud]) gr.clear();
    for (const t of this.hudLabels) t.setVisible(false);
    this.hudLabelIdx = 0;
    if (this.phase === 'play' || this.phase === 'end') this.keyText.setText('');
    switch (this.mode) {
      case 'patitos':
        this.drawPatitos();
        break;
      case 'trocha':
        this.drawTrocha();
        break;
      case 'salto':
        this.drawSalto();
        break;
      case 'cascada':
        this.drawCascada();
        break;
      case 'mano':
        this.drawMano();
        break;
      case 'trucha':
        this.drawTrucha();
        break;
      case 'subida':
        this.drawSubida();
        break;
      case 'bajada':
        this.drawBajada();
        break;
      default:
        this.drawBurger();
    }
    this.parts.draw(this.fx);
    this.drawBars(this.hud);
  }

  // -------------------------------------------------------------------------
  // Patitos
  // -------------------------------------------------------------------------

  /** Las tres piedras de la orilla en cada ronda: lo plana que es cada una (1 = laja perfecta). */
  private pKinds: number[] = [];
  private static readonly LAURA_TIROS = [5, 7, 4];
  private static readonly SURFACE = 128;

  private shuffleKinds(): number[] {
    return Phaser.Utils.Array.Shuffle([1, 0.72, 0.38]);
  }

  private playPatitos(dt: number): void {
    if (this.pWait > 0) {
      this.pWait -= dt;
      if (this.pWait <= 0) this.afterPatito();
      return;
    }
    if (this.pStep === 'elige') {
      if (Controls.consume('left')) {
        this.pPick = (this.pPick + 2) % 3;
        playSfx('cursor');
      }
      if (Controls.consume('right')) {
        this.pPick = (this.pPick + 1) % 3;
        playSfx('cursor');
      }
      this.bigText.setText(`Ronda ${this.pRound + 1} de 3 · elige tu piedra`);
      if (Controls.consume('interact')) {
        this.pChosen.flat = this.pKinds[this.pPick];
        this.pStep = 'angulo';
        this.pAngle = 0.5;
        playSfx('select');
        const k = this.pChosen.flat;
        this.say(k > 0.9 ? 'Laura: «Uy, esa es buena. Plana plana.»' : k > 0.6 ? 'Laura: «Mmm. Pasable.»' : 'Laura: «¿Esa? Eso es una papa, chileno.»', 60, 96, 1500);
      }
    } else if (this.pStep === 'angulo') {
      this.pAngle += this.pAngleDir * 1.3 * dt;
      if (this.pAngle > 1 || this.pAngle < 0) {
        this.pAngleDir *= -1;
        this.pAngle = Phaser.Math.Clamp(this.pAngle, 0, 1);
      }
      this.bigText.setText('E: el ángulo (bajito, en lo verde)');
      if (Controls.consume('interact')) {
        this.pChosen.angle = this.pAngle * 45;
        this.pStep = 'fuerza';
        this.pPower = 0;
        this.pPowerDir = 1;
        playSfx('select');
      }
    } else if (this.pStep === 'fuerza') {
      this.pPower += this.pPowerDir * 1.6 * dt;
      if (this.pPower > 1 || this.pPower < 0) {
        this.pPowerDir *= -1;
        this.pPower = Phaser.Math.Clamp(this.pPower, 0, 1);
      }
      this.bigText.setText('E: la fuerza');
      if (Controls.consume('interact')) {
        this.pChosen.power = this.pPower;
        const a = this.pChosen.angle;
        const angleK = Phaser.Math.Clamp(1 - Math.abs(a - 15) / 22, 0, 1);
        const q = this.pChosen.flat * angleK * (0.3 + 0.7 * this.pPower);
        const n = a > 34 ? 0 : Phaser.Math.Clamp(Math.round(q * 11 + (Math.random() * 2 - 1)), 0, 12);
        this.throwStone('me', n);
        this.bigText.setText('');
      }
    } else if (this.pStep === 'vuela' || this.pStep === 'laura') {
      this.stepStone(dt);
    }
  }

  private throwStone(who: 'me' | 'laura', bounces: number): void {
    playSfx('salto');
    const x = who === 'me' ? 92 : 56;
    this.pThrow = { x, y: PaseoScene.SURFACE, vx: 70 + bounces * 4, hop: 0, hops: 0, left: bounces, z: 22, vz: 40, who };
    this.pStep = who === 'me' ? 'vuela' : 'laura';
  }

  private stepStone(dt: number): void {
    const s = this.pThrow;
    if (!s) return;
    s.x += s.vx * dt;
    s.vz -= 320 * dt;
    s.z += s.vz * dt;
    if (s.z > 0) return;
    if (s.left > 0) {
      s.left--;
      s.hops++;
      s.z = 0;
      s.vz = 44 + s.left * 7;
      s.vx *= 0.93;
      playSfx('bump');
      this.parts.burst(s.x, s.y, 5, 0xe8f8f4, 30, 120, 0.4, 2);
      for (let i = 0; i < 6; i++) this.parts.add({ x: s.x + (i - 2.5) * 3, y: s.y + 1, vx: (i - 2.5) * 14, life: 0.6, color: 0xbfe8f0, size: 2, shrink: true });
      this.pop(String(s.hops), s.who === 'me' ? '#f8e070' : '#ff9cb0', s.x, s.y - 18, 9);
      return;
    }
    // Se hunde.
    playSfx('chapuzon');
    this.parts.burst(s.x, s.y, 10, 0xe8f8f4, 45, 160, 0.6, 2);
    const n = s.hops;
    this.pThrow = null;
    if (s.who === 'me') {
      this.pScores.push(n);
      this.pBest = Math.max(this.pBest, n);
      if (n === 0) this.say('¡Plop! Laura: «Eso no es un patito. Eso es un ahogado.»', 160, 96, 1700);
      else if (n >= 8) this.say(`Laura: «¿${n}? ¡¿${n}?! ...Vale. Vale. No digas nada.»`, 160, 96, 2000);
      else if (n >= 5) this.say(`Danilo: «¡${n}! ¡Eso, chileno!»`, 230, 96, 1500);
      else this.say(`${n}. Ariana: «Bueno, algo es algo, causa.»`, 230, 96, 1500);
      this.pWait = 1.6;
    } else {
      this.pLaura.push(n);
      this.pLauraBest = Math.max(this.pLauraBest, n);
      this.say(['Laura: «Cinco. Calentando, ¿eh?»', 'Laura: «¡SIETE! ¿Ves? Como en Bakio.»', 'Laura: «Cuatro... el viento. Es el viento.»'][this.pRound] ?? `Laura: «${n}.»`, 60, 96, 1800);
      this.pWait = 1.8;
    }
  }

  private afterPatito(): void {
    if (this.pStep === 'vuela') {
      // Le toca a Laura.
      this.throwStone('laura', PaseoScene.LAURA_TIROS[this.pRound]);
      return;
    }
    this.pRound++;
    if (this.pRound >= 3) {
      this.score = this.pBest;
      this.extra = this.pLauraBest;
      this.good = this.pBest >= 5;
      this.perfect = this.pBest > this.pLauraBest;
      this.together = this.pBest >= this.pLauraBest;
      this.endGame(
        this.perfect
          ? `Tu mejor: ${this.pBest}. Laura se queda mirando el agua. «Esto no sale de La Vorágine, ¿vale? En Bakio sigo siendo la campeona.»`
          : this.good
            ? `Tu mejor: ${this.pBest}. Laura: «No está mal. Para ser de un país sin ríos de verdad.» «¡Tenemos ríos!» «Ya.»`
            : `Tu mejor: ${this.pBest}. Laura te enseña a agarrar la piedra con el dedo índice. Te toma la mano para mostrarte. Se demora un poco más de lo necesario.`,
      );
      return;
    }
    this.pKinds = this.shuffleKinds();
    this.pPick = 0;
    this.pStep = 'elige';
  }

  private drawPatitos(): void {
    const b = this.bg;
    const t = this.t;
    const S = PaseoScene.SURFACE;
    cielo(b, 0, 0, BASE_WIDTH, 76, '#6cace4', '#d8eef6');
    nubes(b, BASE_WIDTH, t, 22, 4, 0.85);
    cordillera(b, -10, BASE_WIDTH + 20, 70, 34, '#7896ac', 2);
    cordillera(b, -10, BASE_WIDTH + 20, 78, 22, '#5a8468', 5);
    selva(b, 0, BASE_WIDTH, 80, '#3c7a40', 9, 3, t);
    // Las casas de La Vorágine en la otra orilla.
    for (const [hx, wall, door] of [[150, '#f4f0e6', '#2c9c58'], [190, '#f8e8a8', '#c8303c'], [236, '#f4f0e6', '#2c64c0'], [276, '#e8dcc8', '#e8b828']] as const) {
      b.fillStyle(0x2a2433, 1).fillRect(hx - 1, 79, 32, 15);
      b.fillStyle(Phaser.Display.Color.HexStringToColor(wall).color, 1).fillRect(hx, 80, 30, 13);
      b.fillStyle(0x9c4428, 1).fillTriangle(hx - 4, 81, hx + 15, 71, hx + 34, 81);
      b.fillStyle(0xb8542c, 1).fillRect(hx - 3, 79, 36, 2);
      b.fillStyle(Phaser.Display.Color.HexStringToColor(door).color, 1).fillRect(hx + 4, 85, 6, 8).fillRect(hx + 16, 84, 9, 5);
    }
    for (let i = 0; i < 6; i++) guadua(b, 128 + i * 34 + (i % 2) * 9, 96, 26 + (i % 3) * 6, Math.sin(t * 1.4 + i) * 2);
    // El puente de concreto, con los niños que se tiran.
    b.fillStyle(0x8c8c88, 1).fillRect(0, 86, 118, 6);
    b.fillStyle(0xb8b8b0, 1).fillRect(0, 84, 118, 3);
    for (const px of [20, 62, 104]) b.fillStyle(0x6c6c68, 1).fillRect(px, 92, 6, 12);
    for (let i = 0; i < 4; i++) b.fillStyle([0xe8603c, 0x2c64c0, 0xe8c030, 0x3c9c58][i], 1).fillRect(30 + i * 16, 78, 4, 6);
    const jk = (t % 5) / 5;
    if (jk < 0.25) {
      const kx = 88 + jk * 30;
      const ky = 80 + Math.pow(jk / 0.25, 2) * 22 - Math.sin((jk / 0.25) * Math.PI) * 8;
      b.fillStyle(0xd88848, 1).fillRect(kx, ky, 4, 6);
      if (jk > 0.23) this.parts.burst(kx + 2, 104, 3, 0xe8f8f4, 25, 100, 0.4, 2);
    }
    // El río y la orilla de piedras.
    b.fillStyle(0x8c9c78, 1).fillRect(0, 96, BASE_WIDTH, 6);
    agua(b, 0, 102, BASE_WIDTH, 40, t, '#2f8a9c', 1, 20);
    b.fillStyle(0x1c6a7c, 0.6).fillRect(0, 112, BASE_WIDTH, 14);
    b.fillStyle(0xa8a090, 1).fillRect(0, 140, BASE_WIDTH, 40);
    for (let i = 0; i < 90; i++) {
      const px = (i * 37) % BASE_WIDTH;
      const py = 142 + ((i * 23) % 36);
      b.fillStyle([0x8c8478, 0xb8b0a0, 0x9c9488, 0xc8c0b0][i % 4], 1).fillEllipse(px, py, 6 + (i % 4), 3 + (i % 3));
    }
    b.fillStyle(0xe8f8f4, 0.5).fillRect(0, 139, BASE_WIDTH, 1);
    // Danilo, Mila y Ariana en la piedra grande.
    roca(this.g, 276, 150, 70, 26, '#9c968c');
    this.face(this.g, look('danilo', this.me), 258, 128, 1.7, { mouth: 'grin' });
    this.face(this.g, look('mila', this.me), 280, 129, 1.7, { mouth: 'smile' });
    this.face(this.g, look('ariana', this.me), 302, 128, 1.7, { mouth: this.pThrow ? 'o' : 'teeth' });
    // Laura y tú.
    const throwing = this.pThrow && this.pThrow.x < 140;
    const lauraPose = this.pStep === 'laura' && throwing ? 'lanza' : this.pThrow?.who === 'me' ? 'quieto' : 'quieto';
    this.body(this.g, this.laura, 50, 126, 1.05, { pose: lauraPose, mouth: this.pThrow?.who === 'me' ? 'o' : 'smile' });
    const mePose = this.pStep === 'vuela' && throwing ? 'lanza' : this.pStep === 'angulo' || this.pStep === 'fuerza' ? 'mano_der' : 'quieto';
    this.body(this.g, this.me, 92, 124, 1.1, { pose: mePose, mouth: this.pStep === 'fuerza' ? 'teeth' : 'smile' });
    // Las tres piedras para elegir.
    if (this.phase === 'play' && this.pStep === 'elige') {
      this.pKinds.forEach((k, i) => {
        const x = 122 + i * 20;
        const y = 156;
        const w = 8 + k * 6;
        const h = 10 - k * 6;
        this.g.fillStyle(0x2a2433, 1).fillEllipse(x, y, w + 2, h + 2);
        this.g.fillStyle(0x7c8484, 1).fillEllipse(x, y, w, h);
        this.g.fillStyle(0xa8b0b0, 1).fillEllipse(x - 1, y - 1, w * 0.5, Math.max(1, h * 0.4));
        if (i === this.pPick) {
          const by = 142 + Math.sin(t * 6) * 2;
          this.g.fillStyle(0xf8e070, 1).fillTriangle(x - 4, by, x + 4, by, x, by + 5);
        }
      });
    }
    // Ángulo: un abanico desde la mano; lo verde es lo bueno.
    if (this.phase === 'play' && (this.pStep === 'angulo' || this.pStep === 'fuerza')) {
      const hx = 104;
      const hy = 138;
      const a = (this.pStep === 'angulo' ? this.pAngle * 45 : this.pChosen.angle) * (Math.PI / 180);
      this.hud.fillStyle(0x0c1020, 0.55).slice(hx, hy, 34, -Math.PI / 4, 0, false).fillPath();
      this.hud.fillStyle(0x58c858, 0.85).slice(hx, hy, 34, -(24 * Math.PI) / 180, -(8 * Math.PI) / 180, false).fillPath();
      this.hud.lineStyle(2, 0xf8e070, 1).lineBetween(hx, hy, hx + Math.cos(a) * 36, hy - Math.sin(a) * 36);
      if (this.pStep === 'fuerza') {
        this.meter(150, 150, 70, this.pPower, this.pPower > 0.75 ? 0x58c858 : 0xf8e070, 'Fuerza');
      }
    }
    // La piedra que vuela, con su sombra en el agua.
    const st = this.pThrow;
    if (st) {
      this.g.fillStyle(0x14303c, 0.5).fillEllipse(st.x, S + 2, 6, 2);
      this.g.fillStyle(0x2a2433, 1).fillEllipse(st.x, S - st.z, 7, 4);
      this.g.fillStyle(0x9ca4a4, 1).fillEllipse(st.x, S - st.z - 0.5, 5, 2);
    }
    this.infoText.setText(`Ronda ${Math.min(3, this.pRound + 1)}/3 · Tú: ${this.pBest} · Laura: ${this.pLauraBest}`);
  }

  // -------------------------------------------------------------------------
  // Trocha
  // -------------------------------------------------------------------------

  /** Un bache llega a la marca en `at`; se ve venir 1,6 s antes. */
  private static readonly APPROACH = 1.6;

  private playTrocha(dt: number): void {
    if (Controls.consume('up')) {
      this.lastGrab = this.t;
      playSfx('cursor');
    }
    this.ducking = Controls.isHeld('down');
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    // Las curvas empujan el cuerpo hacia afuera y doblan el camino.
    let force = 0;
    let bend = 0;
    for (const e of this.evs) {
      if (e.kind !== 'izq' && e.kind !== 'der') continue;
      const k = (this.t - e.at) / 1.8;
      const sgn = e.kind === 'izq' ? 1 : -1;
      if (k > 0 && k < 1) force += Math.sin(k * Math.PI) * sgn * 1.15;
      const kb = (this.t - e.at + 1.4) / 3;
      if (kb > 0 && kb < 1) bend += Math.sin(kb * Math.PI) * -sgn;
    }
    this.roadX = bend * 70;
    this.leanV += (force * 2.5 + input * 2.7 - this.lean * 1.4) * dt;
    this.leanV *= 1 - 2.2 * dt;
    this.lean = Phaser.Math.Clamp(this.lean + this.leanV * dt, -1.25, 1.25);
    this.bumpFx = Math.max(0, this.bumpFx - dt * 3);
    if (Math.random() < dt * 9) this.parts.add({ x: Math.random() < 0.5 ? 18 : BASE_WIDTH - 18, y: 70 + Math.random() * 20, vx: (Math.random() - 0.5) * 30, vy: -10, life: 0.8, color: 0xc8a878, size: 3, round: true });

    for (const e of this.evs) {
      if (e.done) continue;
      if (e.kind === 'bache' && this.t >= e.at + 0.12) {
        e.done = true;
        const d = this.lastGrab - e.at;
        if (d >= -0.32 && d <= 0.12) {
          this.score++;
          const justo = Math.abs(d) < 0.09;
          this.pop(justo ? '¡Justo!' : '¡Agarrado!', justo ? '#f8e070' : '#a8e0a0', BASE_WIDTH / 2, 74);
          playSfx('bump');
          this.bumpFx = 0.35;
        } else {
          this.misses++;
          this.bumpFx = 1;
          playSfx('golpe');
          this.cameras.main.shake(220, 0.012);
          this.pop('¡Pum! El techo', '#ff9c9c', BASE_WIDTH / 2, 74);
          const lines = ['Fiorella: «¡Ay, causa, mi cabeza!»', 'Laura: «¡Hostia! ¿Estás bien?»', 'Danilo: «¡Ve, chileno, agarrate!»', 'El conductor: «Eso no es nada, mijo. Espere la de arriba.»', 'Laura: «Que me vas a dejar sin novio... digo, ¡sin vecino!»'];
          this.say(lines[this.misses % lines.length], BASE_WIDTH / 2, 44, 1500);
        }
        this.parts.burst(BASE_WIDTH / 2, 92, 10, 0xb89c74, 50, 120, 0.6, 3);
        // A la mitad del camino, Laura se agarra de tu brazo y ya no se suelta.
        if (!this.lauraGrab && this.evs.indexOf(e) >= 9) {
          this.lauraGrab = true;
          playSfx('latido');
          this.say('Laura se agarra de tu brazo. «Perdón... no te suelto, ¿vale? Por si acaso.»', 230, 44, 2800);
        }
      } else if (e.kind === 'rama' && this.t >= e.at) {
        e.done = true;
        if (this.ducking) {
          this.score++;
          this.pop('¡Agachado!', '#a8e0a0', BASE_WIDTH / 2, 74);
          playSfx('cursor');
        } else {
          this.misses++;
          playSfx('golpe');
          this.cameras.main.shake(160, 0.008);
          this.pop('¡Rama en la cara!', '#ff9c9c', BASE_WIDTH / 2, 74);
          this.say(['Laura: «Tienes una hoja en el pelo. No, déjala. Te queda bien.»', 'Fiorella: «¡Agáchate, chileno! ¡Ay, ya fue!»', 'Danilo: «¡Bienvenido a Pance, mijo!»'][this.misses % 3], BASE_WIDTH / 2, 44, 1500);
          for (let i = 0; i < 8; i++) this.parts.add({ x: 140 + Math.random() * 40, y: 120, vx: (Math.random() - 0.5) * 60, vy: -40 + Math.random() * 30, life: 1.2, color: 0x4c9c3c, size: 3, grav: 60 });
        }
      } else if ((e.kind === 'izq' || e.kind === 'der') && this.t >= e.at + 1.8) {
        e.done = true;
        if (Math.abs(this.lean) < 0.75) {
          this.score++;
          this.pop('¡Firme!', '#a8e0a0', BASE_WIDTH / 2, 74);
        } else {
          this.misses++;
          playSfx('golpe');
          this.say(this.lean < 0 ? 'Fiorella: «¡Chileno, que me sacas por la ventana!»' : 'Laura: «Que me aplastas, tío... bueno, no tanto.»', BASE_WIDTH / 2, 44, 1400);
        }
      }
    }
    const next = this.evs.find((e) => !e.done);
    this.infoText.setText(`Bien: ${this.score} · Golpes: ${this.misses}`);
    if (!next) {
      this.together = this.lauraGrab;
      this.good = this.misses <= 5;
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

  private drawTrocha(): void {
    const b = this.bg;
    const g = this.g;
    const t = this.t;
    const shake = this.bumpFx > 0 ? Math.sin(t * 70) * 3 * this.bumpFx : 0;
    const HZ = 60;
    const vx = BASE_WIDTH / 2 + this.roadX;
    // El paisaje por el parabrisas.
    cielo(b, 0, 0, BASE_WIDTH, HZ + 4, '#5ca4e0', '#cfe8f4');
    nubes(b, BASE_WIDTH, t, 18, 4, 0.8, 6);
    cordillera(b, -40 + this.roadX * 0.2, BASE_WIDTH + 80, HZ - 4, 30, '#7090a8', 3, true);
    cordillera(b, -40 + this.roadX * 0.4, BASE_WIDTH + 80, HZ + 2, 18, '#4a7a5c', 7);
    b.fillStyle(0x5aa04a, 1).fillRect(0, HZ, BASE_WIDTH, 40);
    // La trocha en perspectiva.
    const BOT = 100;
    b.fillStyle(0xa07c54, 1).fillTriangle(vx - 6, HZ, vx + 6, HZ, BASE_WIDTH / 2 + 150, BOT).fillTriangle(vx - 6, HZ, BASE_WIDTH / 2 - 150, BOT, BASE_WIDTH / 2 + 150, BOT);
    for (let i = 0; i < 9; i++) {
      const z = ((i / 9 + t * 0.9) % 1);
      const y = HZ + z * z * (BOT - HZ);
      const half = 6 + z * z * 144;
      const cx = vx + (BASE_WIDTH / 2 - vx) * z * z;
      for (let j = 0; j < 4; j++) b.fillStyle(j % 2 ? 0x8c6a44 : 0xb8946a, 1).fillRect(cx - half + ((i * 37 + j * 53) % 100) / 100 * half * 2, y, 2 + z * 8, 1 + z * 2);
      // Piedritas y matas a los lados.
      b.fillStyle(0x3c8040, 1).fillCircle(cx - half - 6 - z * 20, y, 1 + z * 6).fillCircle(cx + half + 8 + z * 24, y + 1, 1 + z * 7);
    }
    // Las ruedas de los que pasaron antes.
    b.lineStyle(1, 0x7a5a38, 1).lineBetween(vx - 2, HZ, BASE_WIDTH / 2 - 60, BOT).lineBetween(vx + 2, HZ, BASE_WIDTH / 2 + 60, BOT);
    // Guaduas que pasan por los lados.
    for (let i = 0; i < 5; i++) {
      const z = ((i / 5 + t * 0.55) % 1);
      const zz = z * z;
      const cx = vx + (BASE_WIDTH / 2 - vx) * zz;
      for (const side of [-1, 1]) guadua(b, cx + side * (20 + zz * 210), HZ + zz * 40, 6 + zz * 70, Math.sin(t * 2 + i) * 2 * zz);
    }
    // Los baches y las ramas que se acercan.
    for (const e of this.evs) {
      if (e.done) continue;
      const k = 1 - (e.at - t) / PaseoScene.APPROACH;
      if (k < 0 || k > 1.05) continue;
      const zz = k * k;
      const cx = vx + (BASE_WIDTH / 2 - vx) * zz + Math.sin(e.at * 3) * 30 * zz;
      const y = HZ + zz * (96 - HZ);
      if (e.kind === 'bache') {
        b.fillStyle(0x4a3018, 1).fillEllipse(cx, y, 6 + zz * 46, 2 + zz * 9);
        b.fillStyle(0x6a4a2c, 1).fillEllipse(cx, y - zz * 2, 4 + zz * 36, 1 + zz * 5);
        b.fillStyle(0x7cb8d8, 0.7).fillEllipse(cx + zz * 4, y, 2 + zz * 14, 1 + zz * 3);
      } else if (e.kind === 'rama') {
        const by = 10 + zz * 40;
        g.lineStyle(2 + zz * 5, 0x5a3c24, 1).lineBetween(-10, by - 10 * zz, 140 + zz * 120, by + 6 * zz);
        for (let i = 0; i < 7; i++) g.fillStyle(i % 2 ? 0x3c8c3c : 0x5aac4c, 1).fillEllipse(20 + i * (14 + zz * 22), by + 4 + (i % 2) * 5 * zz, 6 + zz * 16, 4 + zz * 8);
      }
    }
    // La marca: cuando el bache llega aquí, W.
    b.lineStyle(1, 0xf8e070, 0.9).lineBetween(BASE_WIDTH / 2 - 70, 96, BASE_WIDTH / 2 + 70, 96);
    // El Willys por dentro: el techo de lona, los parales, el parabrisas y el capó verde.
    g.fillStyle(0x6c6c48, 1).fillRect(0, 0, BASE_WIDTH, 12);
    for (let x = 4; x < BASE_WIDTH; x += 10) g.fillStyle(0x5a5a3c, 1).fillRect(x, 2, 5, 1);
    g.fillStyle(0x4a4a30, 1).fillRect(0, 11, BASE_WIDTH, 2);
    g.fillStyle(0x2c4a2c, 1).fillRect(0, 0, 14, 104).fillRect(BASE_WIDTH - 14, 0, 14, 104);
    g.fillStyle(0x3c5c38, 1).fillRect(26, 22, 4, 66).fillRect(BASE_WIDTH - 30, 22, 4, 66).fillRect(26, 20, BASE_WIDTH - 52, 4);
    g.fillStyle(0x4c6c3c, 1).fillRect(26, 84, BASE_WIDTH - 52, 10);
    g.fillStyle(0x5c7c48, 1).fillRect(26, 84, BASE_WIDTH - 52, 2);
    g.fillStyle(0x2a2a30, 1).fillRect(14, 94, BASE_WIDTH - 28, 14);
    for (const gx of [60, 82]) {
      g.fillStyle(0x14141a, 1).fillCircle(gx, 101, 5);
      g.fillStyle(0xe8e0c8, 1).fillCircle(gx, 101, 4);
      g.lineStyle(1, 0xc8303c, 1).lineBetween(gx, 101, gx + Math.cos(t * 3 + gx) * 3, 101 - 2);
    }
    // El espejo retrovisor con los ojos del conductor.
    g.fillStyle(0x14141a, 1).fillRect(BASE_WIDTH / 2 - 16, 24, 32, 9);
    g.fillStyle(0x9cb8c8, 1).fillRect(BASE_WIDTH / 2 - 15, 25, 30, 7);
    g.fillStyle(0xd8a078, 1).fillRect(BASE_WIDTH / 2 - 10, 26, 20, 5);
    g.fillStyle(0x202028, 1).fillRect(BASE_WIDTH / 2 - 6, 28, 3, 1).fillRect(BASE_WIDTH / 2 + 3, 28, 3, 1);
    // Los de adelante: el conductor (con el timón) y Danilo con su sombrero vueltiao.
    const jolt = this.bumpFx * 3;
    g.fillStyle(0x5a4030, 1).fillRoundedRect(76, 104 + jolt, 64, 40, 6).fillRoundedRect(180, 104 + jolt, 64, 40, 6);
    g.lineStyle(4, 0x1c1c22, 1).strokeCircle(108, 118, 22);
    g.fillStyle(0x1c1c20, 1).fillCircle(108, 104 + jolt, 13);
    g.fillStyle(0x78a8d8, 1).fillRect(92, 114 + jolt, 32, 12);
    g.fillStyle(0xa87048, 1).fillCircle(212, 106 + jolt, 12);
    g.fillStyle(0x1c1418, 1).fillCircle(212, 104 + jolt, 11);
    g.fillStyle(0xf4f0e6, 1).fillEllipse(212, 98 + jolt, 44, 9);
    g.fillStyle(0xf4f0e6, 1).fillEllipse(212, 93 + jolt, 22, 10);
    g.fillStyle(0x1c1418, 1).fillRect(202, 94 + jolt, 20, 2).fillRect(194, 99 + jolt, 36, 1);
    g.fillStyle(0xf4f0e6, 1).fillRect(196, 112 + jolt, 32, 12);
    // Atrás: Fiorella, tú y Laura.
    const fg = this.fg;
    const lean = this.lean * 18;
    const by = 132 + shake + (this.ducking ? 10 : 0);
    const hit = this.bumpFx > 0.5;
    const grab = t - this.lastGrab < 0.35;
    this.body(fg, look('fiorella', this.me), 74 + Math.min(0, lean) * 0.6, 134 + shake, 2.6, { medio: true, mouth: hit ? 'o' : 'smile' });
    this.body(fg, this.me, 160 + lean, by - (grab ? 3 : 0), 2.8, { medio: true, pose: grab ? 'arriba' : 'quieto', mouth: hit ? 'o' : 'smile', eyes: hit ? 'closed' : 'open' });
    this.body(fg, this.laura, 246 + Math.max(0, lean) * 0.6, 134 + shake, 2.6, { medio: true, mouth: this.lauraGrab ? 'smile' : hit ? 'o' : 'grin', blush: this.lauraGrab });
    if (this.lauraGrab) manos(fg, 222 + Math.max(0, lean) * 0.6, 168 + shake, 186 + lean, 166 + shake, this.laura.skin, 3);
    // La barra de agarrarse (se ilumina cuando la agarras).
    g.fillStyle(grab ? 0xf8e070 : 0x8c8c94, 1).fillRect(132, 14, 56, 4);
    // Lo que viene: W, S o la curva.
    const next = this.evs.find((e) => !e.done);
    let curva = '';
    if (next && this.phase === 'play') {
      const left = next.at - t;
      if ((next.kind === 'bache' || next.kind === 'rama') && left < PaseoScene.APPROACH && left > -0.2) {
        const k = Phaser.Math.Clamp(left / PaseoScene.APPROACH, 0, 1);
        const key: Key = next.kind === 'bache' ? 'up' : 'down';
        tecla(this.hud, 294, 44, k, KEY_COLOR[key], key === 'up' ? grab : this.ducking);
        this.keyText.setText(KEY_LABEL[key]).setPosition(294, 43);
      } else if ((next.kind === 'izq' || next.kind === 'der') && left < 1.4) {
        // La curva a la izquierda te tira a la derecha: se compensa con A (y al revés).
        curva = next.kind === 'izq' ? '⟵ CURVA · mantén A' : 'mantén D · CURVA ⟶';
      }
    }
    if (this.phase === 'play') this.bigText.setText(curva);
    // Lo inclinado que vas.
    this.meter(10, 22, 60, 0.5 + this.lean / 2.5, Math.abs(this.lean) < 0.75 ? 0x58c858 : 0xe85a64, 'Equilibrio');
  }

  // -------------------------------------------------------------------------
  // Salto
  // -------------------------------------------------------------------------

  private static readonly ROCK_TOP = [110, 88, 100];
  private static readonly HONDO: Array<[number, number]> = [
    [180, 266],
    [198, 252],
    [196, 262],
  ];
  private static readonly TRUCOS: Partial<Record<Key, string>> = { up: '¡Bomba!', left: '¡Clavado!', right: '¡Estrella!' };

  private playSalto(dt: number): void {
    if (this.sStep === 'agua') {
      this.waterT -= dt;
      if (Math.random() < dt * 20) this.parts.add({ x: this.landX + (Math.random() - 0.5) * 10, y: 150, vy: -30, life: 0.6, color: 0xbfe8f4, size: 2, round: true });
      if (this.waterT <= 0) this.nextJump();
      return;
    }
    if (this.sStep === 'vuelo') {
      this.flyT += dt / 1.05;
      if (this.trick && !this.trickDone && this.flyT > 0.18 && this.flyT < 0.68) {
        for (const k of KEYS) {
          if (!Controls.consume(k)) continue;
          if (k === this.trick) {
            this.trickDone = 'ok';
            this.tricks++;
            playSfx('select');
            this.pop(PaseoScene.TRUCOS[k] ?? '¡Eso!', '#f8e070', 160, 50);
          } else {
            this.trickDone = 'mal';
            this.pop('¡Panzazo!', '#ff9c9c', 160, 50);
          }
          break;
        }
      }
      if (this.flyT >= 1) this.land();
      return;
    }
    if (this.jump === 2) {
      // El de a dos: Laura cuenta en euskera y hay que saltar en el «hiru».
      this.sStep = 'cuenta';
      const before = this.count;
      this.count += dt;
      for (const beat of [0, 0.9, 1.8]) if (before < beat + 0.001 && this.count >= beat + 0.001) playSfx(beat === 1.8 ? 'select' : 'blip');
      const words = ['Bat...', 'Bi...', '¡HIRU!'];
      this.bigText.setText(`Laura: ${words[Math.min(2, Math.floor(this.count / 0.9))]}`);
      if (this.count > 3.6) {
        this.count = 0;
        this.say('Laura: «Que no has saltado, tonto. Otra vez. Bat, bi, hiru: ¡en el tres!»', 160, 60, 1600);
      }
      if (Controls.consume('interact')) {
        const onTime = this.count >= 1.75 && this.count < 2.75;
        this.startJump(onTime ? 228 : 150, onTime, null);
        if (!onTime) this.together = false;
      }
      return;
    }
    const speed = 0.75 + this.jump * 0.3;
    this.ring += this.ringDir * speed * dt;
    if (this.ring > 1 || this.ring < 0) {
      this.ringDir *= -1;
      this.ring = Phaser.Math.Clamp(this.ring, 0, 1);
    }
    this.bigText.setText(['Salto 1: la piedra baja', 'Salto 2: la alta (cuatro metros)', ''][this.jump]);
    if (Controls.consume('interact')) {
      const x = 112 + this.ring * 168;
      const [a, b] = PaseoScene.HONDO[this.jump];
      const tricks: Key[] = ['up', 'left', 'right'];
      this.startJump(x, x >= a && x <= b, tricks[Math.floor(Math.random() * 3)]);
    }
  }

  private startJump(x: number, deep: boolean, trick: Key | null): void {
    this.landX = x;
    this.deep = deep;
    this.trick = trick;
    this.trickDone = null;
    this.flyT = 0;
    this.sStep = 'vuelo';
    this.bigText.setText('');
    playSfx('salto');
  }

  private land(): void {
    const x = this.landX;
    const panzazo = this.trickDone === 'mal';
    if (this.deep) {
      this.score++;
      playSfx('chapuzon');
      this.parts.burst(x, 132, panzazo ? 34 : 24, 0xe8f8f4, panzazo ? 110 : 90, 220, 0.9, 3);
      this.parts.burst(x, 132, 10, 0x9cd8e8, 50, 200, 0.7, 2);
      this.cameras.main.shake(140, 0.006);
      const lines = [
        'Danilo: «¡Eso, chileno! ¡Bautizado en el Pance!»',
        'Ariana: «¡Asu, de la alta! Estás loco, causa.»',
        'Salen los dos a flote al mismo tiempo, todavía de la mano. Laura se ríe con el pelo en la cara.',
      ];
      this.say(panzazo ? 'Mila: «¡Uy, ese panzazo se oyó en Cali!»' : lines[this.jump], 160, 50, 2200);
    } else {
      this.misses++;
      playSfx('golpe');
      this.parts.burst(x, 132, 10, 0xe8f8f4, 50, 200, 0.5, 2);
      this.say(this.jump === 2 ? 'Saltan descoordinados. Laura: «¡Que era en el hiru! ¡Hiru es TRES!»' : 'Caes en lo bajito. Pies raspados. Mila: «Uy, eso dolió hasta acá.»', 160, 50, 2200);
    }
    this.sStep = 'agua';
    this.waterT = 1.5;
  }

  private nextJump(): void {
    this.jump++;
    this.count = 0;
    this.ring = 0;
    this.sStep = 'apunta';
    if (this.jump >= 3) {
      this.extra = this.tricks;
      this.good = this.score >= 2;
      this.perfect = this.score === 3;
      this.endGame(
        this.perfect
          ? `Tres de tres al pozo${this.tricks >= 2 ? ', con estilo' : ''}. Y el último de la mano. El agua está helada y a ninguno de los dos le importa.`
          : this.good
            ? `${this.score} de 3 al pozo. Danilo: «Aprobado. Puede almorzar.»`
            : 'Más raspones que saltos. Fiorella te pasa una curita que nadie sabe de dónde sacó.',
      );
    }
  }

  private drawSalto(): void {
    const b = this.bg;
    const g = this.g;
    const t = this.t;
    cielo(b, 0, 0, BASE_WIDTH, 60, '#68a8e0', '#d4ecf4');
    nubes(b, BASE_WIDTH, t, 14, 3, 0.85);
    // Las paredes del cañón con selva y la cascadita del fondo.
    b.fillStyle(0x4a5248, 1).fillRect(0, 40, BASE_WIDTH, 92);
    selva(b, 0, BASE_WIDTH, 40, '#2c6a34', 13, 1, t);
    selva(b, 0, BASE_WIDTH, 62, '#3c7c3c', 10, 4, t, 0.8);
    b.fillStyle(0x5a5e58, 1).fillRect(186, 66, 34, 60);
    b.fillStyle(0xd8eef4, 0.95).fillRect(196, 66, 12, 64);
    for (let y = 66 + ((t * 80) % 8); y < 128; y += 8) b.fillStyle(0xffffff, 1).fillRect(198 + ((y * 3) % 7), y, 2, 4);
    for (let i = 0; i < 5; i++) helecho(b, 160 + i * 34, 104 + (i % 2) * 6, 0.9, '#3c8c3c', t);
    // El pozo: lo bajito (claro) a la izquierda, lo hondo (oscuro) al medio.
    agua(b, 96, 128, 224, 52, t, '#2a7c94', 1, 10);
    b.fillStyle(0x7cd0d0, 0.5).fillRect(96, 132, 76, 48);
    for (const [rx, ry] of [[120, 150], [146, 164], [110, 170], [160, 146]] as const) b.fillStyle(0x6c8478, 0.6).fillEllipse(rx, ry, 18, 7);
    b.fillStyle(0x0c3c54, 0.5).fillRect(190, 136, 90, 44);
    b.fillStyle(0xe8f8f4, 0.6).fillEllipse(202, 130, 30, 4 + Math.sin(t * 6));
    // La piedra de la derecha con Danilo y Mila.
    roca(b, 304, 140, 60, 40, '#7c786c');
    const cheer = this.sStep === 'agua' && this.deep;
    const jumpy = cheer ? Math.abs(Math.sin(t * 10)) * 3 : 0;
    this.body(g, look('danilo_bano', this.me), 292, 96 - jumpy, 0.72, { pose: cheer ? 'arriba' : 'quieto', mouth: 'grin' });
    this.body(g, look('mila_bano', this.me), 312, 97 - jumpy, 0.72, { pose: cheer ? 'arriba' : 'quieto', mouth: cheer ? 'teeth' : 'smile' });
    // La piedra de donde se salta (más alta en el segundo).
    const top = PaseoScene.ROCK_TOP[Math.min(2, this.jump)];
    b.fillStyle(0x2a2433, 1).fillPoints([{ x: 0, y: top - 2 }, { x: 92, y: top - 2 }, { x: 104, y: top + 12 }, { x: 112, y: 180 }, { x: 0, y: 180 }], true);
    b.fillStyle(0x6c6a62, 1).fillPoints([{ x: 0, y: top }, { x: 90, y: top }, { x: 101, y: top + 12 }, { x: 108, y: 180 }, { x: 0, y: 180 }], true);
    b.fillStyle(0x8c8a80, 1).fillRect(0, top, 90, 4);
    for (let y = top + 12; y < 180; y += 14) b.fillStyle(0x5a5850, 1).fillRect(8 + (y % 30), y, 40, 2);
    b.fillStyle(0x4a7c3c, 1).fillEllipse(30, top + 20, 26, 6);
    // Fiorella y Ariana miran desde atrás.
    this.body(g, look('fiorella', this.me), 14, top - 24, 0.66, { mouth: 'smile' });
    this.body(g, look('ariana', this.me), 32, top - 24, 0.66, { mouth: cheer ? 'teeth' : 'grin' });
    // El que salta (y Laura, en el tercero).
    const edgeX = 84;
    const s = 0.9;
    const standY = top - 34 * s;
    const meB = this.meBano;
    if (this.sStep === 'vuelo') {
      const k = this.flyT;
      const x = edgeX + (this.landX - edgeX) * k;
      const y = standY + (126 - standY) * k - Math.sin(k * Math.PI) * 44;
      const tp = this.trickDone === 'ok' ? (this.trick === 'up' ? 'agacha' : this.trick === 'left' ? 'arriba' : 'salto') : 'salto';
      this.body(g, meB, x, y, s, { pose: tp, mouth: 'open', eyes: this.trickDone === 'mal' ? 'closed' : 'open' });
      if (this.jump === 2) {
        this.body(g, this.laura, x - 18, y + 2, s, { pose: 'salto', mouth: 'open', eyes: 'closed' });
        manos(g, x - 11, y + 12, x - 6, y + 12, this.laura.skin, 2);
      }
    } else if (this.sStep === 'agua') {
      const k = 1 - this.waterT / 1.5;
      if (k > 0.45 || !this.deep) {
        const hy = this.deep ? 130 : 120;
        this.face(g, meB, this.landX, hy, 1.7, { mouth: 'grin', eyes: 'squint' });
        if (this.jump === 2) this.face(g, this.laura, this.landX - 20, hy + 1, 1.7, { mouth: 'teeth', eyes: 'closed' });
        this.fg.fillStyle(0x2a7c94, 0.85).fillRect(this.landX - 34, 134, 68, 8);
      }
    } else {
      this.body(g, meB, edgeX - 4, standY, s, { pose: this.jump === 2 ? 'mano_izq' : 'quieto', mouth: 'grin' });
      this.body(g, this.laura, edgeX - 26, standY + 1, s, { pose: this.jump === 2 ? 'mano_der' : 'quieto', mouth: this.jump === 2 ? 'teeth' : 'smile' });
    }
    // El aro que corre por el agua (en los dos primeros).
    if (this.phase === 'play' && this.sStep === 'apunta' && this.jump < 2) {
      const x = 112 + this.ring * 168;
      const [a, bb] = PaseoScene.HONDO[this.jump];
      this.hud.lineStyle(1, 0x58c858, 0.7).strokeEllipse((a + bb) / 2, 132, bb - a, 6);
      const ok = x >= a && x <= bb;
      this.hud.lineStyle(2, ok ? 0x58ff78 : 0xf8e070, 1).strokeEllipse(x, 132, 20, 6);
      this.hud.fillStyle(ok ? 0x58ff78 : 0xf8e070, 1).fillTriangle(x - 4, 116, x + 4, 116, x, 122);
    }
    // El truco: la tecla en el aire.
    if (this.sStep === 'vuelo' && this.trick && !this.trickDone && this.flyT > 0.18 && this.flyT < 0.68) {
      tecla(this.hud, 160, 72, 1 - (this.flyT - 0.18) / 0.5, KEY_COLOR[this.trick]);
      this.keyText.setText(KEY_LABEL[this.trick]).setPosition(160, 71);
    }
    // La cuenta de Laura: tres puntos.
    if (this.sStep === 'cuenta' && this.phase === 'play') {
      for (let i = 0; i < 3; i++) {
        const on = this.count >= i * 0.9;
        this.hud.fillStyle(0x0c1020, 0.8).fillCircle(136 + i * 24, 46, 8);
        this.hud.fillStyle(i === 2 ? 0xff7a9c : 0xf8e070, on ? 1 : 0.2).fillCircle(136 + i * 24, 46, 6);
      }
    }
    this.infoText.setText(`Salto ${Math.min(3, this.jump + 1)}/3 · Hondo: ${this.score} · Trucos: ${this.tricks}`);
  }

  // -------------------------------------------------------------------------
  // Cascada
  // -------------------------------------------------------------------------

  private playCascada(dt: number): void {
    const DUR = 20;
    this.pushTimer -= dt;
    if (this.pushTimer <= 0) {
      this.push = this.nextPush * (0.8 + Math.random() * 0.9);
      this.nextPush = Math.random() < 0.5 ? -1 : 1;
      this.pushTimer = 1.1 + Math.random() * 1.1;
    }
    let input = 0;
    if (Controls.isHeld('left')) input -= 1;
    if (Controls.isHeld('right')) input += 1;
    this.vel += (this.push * 1.6 + input * 2.5 - this.pos * 0.4) * dt;
    this.vel *= 1 - 2.4 * dt;
    this.pos = Phaser.Math.Clamp(this.pos + this.vel * dt, -1.3, 1.3);
    const under = Math.abs(this.pos) < 0.45;
    if (under) this.held += dt;
    if (Math.abs(this.pos) > 0.95) {
      this.apart += dt;
      if (this.apart > 0.6 && this.together) {
        this.together = false;
        playSfx('chapuzon');
        this.say('El chorro te arrastra y se sueltan. Laura te busca con la mano: «¡Ven aquí!»', 160, 40, 1800);
      }
    } else this.apart = 0;
    if (!this.together && under && Math.abs(this.pos) < 0.2 && this.t > 4) {
      this.together = true;
      playSfx('latido');
      this.say('Le vuelves a agarrar la mano. No se sueltan más.', 160, 40, 1600);
    }
    // Los gritos: Laura avisa y hay que gritar con ella.
    if (this.shout > 0) {
      this.shout -= dt;
      if (Controls.consume('interact')) {
        this.shout = 0;
        this.shouts++;
        playSfx('latido');
        this.pop('¡AAAAAAH!', '#f8e070', 160, 60, 13);
        for (let i = 0; i < 6; i++) this.parts.add({ x: 150 + Math.random() * 30, y: 90, vx: (Math.random() - 0.5) * 30, vy: -40, life: 1.2, color: 0xff8aa8, size: 3 });
      } else if (this.shout <= 0) this.say('Laura grita sola. «¡Cobarde!» Se ríe.', 160, 40, 1400);
    } else if (this.shoutAt.length > 0 && this.t >= this.shoutAt[0]) {
      this.shoutAt.shift();
      this.shout = 1.3;
      this.say(this.shouts === 0 ? 'Laura: «¡A la de tres gritamos! ¡YA!»' : 'Laura: «¡Otra vez! ¡GRITA!»', 160, 40, 1300);
    }
    this.infoText.setText(`Debajo: ${Math.floor(this.held)} s · Quedan ${Math.max(0, Math.ceil(DUR - this.t))} s`);
    if (this.t >= DUR) {
      this.score = Math.floor(this.held);
      this.good = this.score >= 11;
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

  private drawCascada(): void {
    const b = this.bg;
    const g = this.g;
    const t = this.t;
    const cx = BASE_WIDTH / 2;
    // La pared de roca negra y mojada, la selva arriba y el cielo por la rendija.
    cielo(b, 0, 0, BASE_WIDTH, 22, '#8cc4e8', '#e0f0f8', 4);
    selva(b, 0, BASE_WIDTH, 16, '#2c5a30', 11, 2, t);
    b.fillStyle(0x26282c, 1).fillRect(0, 24, BASE_WIDTH, 130);
    for (let i = 0; i < 46; i++) {
      const bx = (i * 53) % BASE_WIDTH;
      const by = 26 + ((i * 37) % 110);
      b.fillStyle(i % 3 ? 0x33363b : 0x2c2e33, 1).fillRect(bx, by, 22 + (i % 4) * 6, 10 + (i % 3) * 4);
      if (i % 4 === 0) b.fillStyle(0x3c6a34, 1).fillRect(bx + 2, by, 10, 3);
    }
    for (let i = 0; i < 6; i++) helecho(b, i < 3 ? 14 + i * 26 : 230 + (i - 3) * 30, 44 + (i % 3) * 30, 1, '#3c8c3c', t);
    // Rayos de luz.
    for (let i = 0; i < 3; i++) b.fillStyle(0xfff8d0, 0.07).fillTriangle(40 + i * 40, 22, 70 + i * 40, 22, 130 + i * 50, 150);
    // La Chorrera: una cortina blanca que tiembla.
    for (let y = 22; y < 140; y += 4) {
      const w = 54 + Math.sin(y * 0.2 + t * 6) * 4 + (y - 22) * 0.14;
      b.fillStyle(0xdff0f6, 0.96).fillRect(cx - w / 2, y, w, 4);
    }
    for (let i = 0; i < 26; i++) {
      const sx = cx - 26 + ((i * 7) % 52);
      const sy = 22 + ((i * 29 + t * 230) % 118);
      b.fillStyle(i % 3 ? 0xb8dce8 : 0xffffff, 1).fillRect(sx, sy, 2, 9 + (i % 3) * 3);
    }
    // El arcoíris en la neblina.
    const colors = [0xe85a5a, 0xf8a040, 0xf8e070, 0x58c858, 0x4a9ad8, 0x8a5ad8];
    colors.forEach((c, i) => {
      b.lineStyle(2, c, 0.18);
      b.beginPath();
      b.arc(cx - 40, 150, 64 - i * 2, Math.PI * 1.05, Math.PI * 1.45, false);
      b.strokePath();
    });
    // El pozo.
    agua(b, 0, 132, BASE_WIDTH, 48, t, '#1f6a80', 1, 8);
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.8 + i / 3) % 1;
      b.lineStyle(1, 0xe8f8f4, 0.6 * (1 - k)).strokeEllipse(cx, 138, 60 + k * 140, 6 + k * 14);
    }
    if (Math.random() < 0.7) this.parts.add({ x: cx + (Math.random() - 0.5) * 70, y: 136, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 20, life: 1.4, color: 0xf4fafc, size: 2, round: true, alpha: 0.45 });
    // Tú y Laura, en el agua hasta el pecho.
    const px = cx + this.pos * 80;
    const lx = this.together ? px + 30 : cx + 74 + Math.sin(t * 2) * 6;
    const under = Math.abs(this.pos) < 0.45;
    const meB = this.meBano;
    this.body(g, meB, px, 104, 2, { medio: true, pose: this.shout > 0 ? 'arriba' : 'quieto', mouth: under ? 'o' : 'open', eyes: under ? 'closed' : 'open', mojado: true });
    this.body(g, this.laura, lx, 106, 2, { medio: true, mouth: this.shout > 0 ? 'open' : this.together ? 'grin' : 'o', eyes: under ? 'closed' : 'open', mojado: true });
    if (this.together) manos(g, px + 14, 132, lx - 14, 132, this.laura.skin, 3);
    if (under) for (let i = 0; i < 6; i++) this.fg.fillStyle(0xffffff, 0.8).fillRect(px - 12 + ((i * 5 + Math.floor(t * 50)) % 26), 80 + ((i * 9 + t * 160) % 20), 2, 7);
    this.fg.fillStyle(0x1f6a80, 0.88).fillRect(0, 138, BASE_WIDTH, 42);
    this.fg.fillStyle(0xe8f8f4, 0.7).fillEllipse(px, 138, 40, 4).fillEllipse(lx, 138, 36, 4);
    // Hacia dónde se carga el chorro (aviso).
    if (this.phase === 'play' && this.pushTimer < 0.7) {
      const dir = this.nextPush;
      for (let i = 0; i < 3; i++) {
        const ax = cx + dir * (10 + i * 12 + ((t * 40) % 12));
        this.hud.fillStyle(0xf8e070, 0.9).fillTriangle(ax, 56, ax - dir * 7, 51, ax - dir * 7, 61);
      }
    }
    this.meter(10, 22, 70, this.held / 15, this.held >= 15 ? 0x58c858 : 0x58d4d0, 'Debajo del chorro');
    if (this.shout > 0) {
      tecla(this.hud, 294, 44, this.shout / 1.3, 0xff8aa8);
      this.keyText.setText('E').setPosition(294, 43);
    }
  }

  // -------------------------------------------------------------------------
  // Mano (las piedras)
  // -------------------------------------------------------------------------

  private standSunk = false;

  private cell(c: number, r: number): [number, number] {
    return [96 + c * 32, 150 - r * 13.4];
  }

  private stoneAt(c: number, r: number): Stone | undefined {
    return this.stones.find((s) => s.x === c && s.y === r);
  }

  private sunk(s: Stone): boolean {
    return s.kind === 'hunde' && Math.sin(this.t * 1.7 + s.off) < -0.35;
  }

  private slip(text: string): void {
    this.slips++;
    this.slipFx = 1;
    playSfx('chapuzon');
    const [x, y] = this.cell(this.col, this.row);
    this.parts.burst(x, y, 14, 0xe8f8f4, 60, 200, 0.6, 2);
    this.cameras.main.shake(140, 0.006);
    this.say(text, 160, 40, 1800);
    if (this.slips >= 3) this.together = false;
  }

  private playMano(dt: number): void {
    this.slipFx = Math.max(0, this.slipFx - dt * 2);
    if (this.t > 90) {
      // Danilo se mete al agua y los cruza a los dos del brazo.
      this.slips = Math.max(this.slips, 3);
      this.say('Danilo se mete al río y los cruza a los dos del brazo. «¡Ve, qué par de tortugas!»', 160, 40, 2000);
      this.finishMano();
      return;
    }
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt);
      return;
    }
    // Laura se resbala: hay que agarrarla.
    if (this.grabQte > 0) {
      this.grabQte -= dt;
      if (Controls.consume('interact')) {
        this.grabQte = 0;
        playSfx('latido');
        this.pop('¡Te tengo!', '#ff8aa8', 160, 70);
        this.say('Laura se queda colgada de tu mano, con un pie en el agua. «...Gracias. No me sueltes.»', 160, 40, 1800);
        return;
      }
      if (this.grabQte <= 0) {
        this.slips++;
        if (this.slips >= 3) this.together = false;
        playSfx('chapuzon');
        this.say('Laura se va al agua hasta la cintura. «¡Está HELADA!» Te tira agua a la cara.', 160, 40, 1800);
      }
      return;
    }
    const st = this.row > 0 ? this.stoneAt(this.col, this.row) : undefined;
    if (st && st.kind === 'hunde') {
      const s = this.sunk(st);
      if (s && !this.standSunk && !st.used) {
        st.used = true;
        this.slip('La piedra se hunde debajo de ustedes. Agua hasta las rodillas. Laura: «¡Que se mueve! ¡Que se MUEVE!»');
      }
      this.standSunk = s;
    } else this.standSunk = false;
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
      this.lCol = this.col;
      this.lRow = this.row;
      this.row = 9;
      this.hop = 0.2;
      this.time.delayedCall(350, () => this.finishMano());
      return;
    }
    const target = tr === 0 ? undefined : this.stoneAt(tc, tr);
    if (tr > 0 && !target) {
      this.pop('Ahí no hay piedra', '#f8e070', 160, 70, 9);
      playSfx('bump');
      return;
    }
    this.lCol = this.col;
    this.lRow = this.row;
    this.col = tc;
    this.row = tr;
    this.hop = 0.2;
    playSfx('cursor');
    if (target?.kind === 'floja' && !target.used) {
      target.used = true;
      const lines = ['Se mueve la piedra. Laura te aprieta la mano: «¡Hostia, hostia!»', 'Otro resbalón. Quedan mojados hasta la rodilla. Laura se ríe de nervios.', 'Al agua los dos. Salen empapados... y todavía de la mano.'];
      this.time.delayedCall(200, () => this.slip(lines[Math.min(2, this.slips)]));
    } else if (target && this.sunk(target)) {
      this.time.delayedCall(200, () => this.slip('Pisas una piedra que está debajo del agua. Splash. Laura: «¡Espérala a que suba, tonto!»'));
      this.standSunk = true;
    } else if (this.qteRows.length > 0 && this.row >= this.qteRows[0]) {
      this.qteRows.shift();
      this.time.delayedCall(260, () => {
        this.grabQte = 0.85;
        playSfx('error');
        this.say('¡Laura se resbala! (E)', 160, 40, 900);
      });
    } else if (this.row === 4) this.say('Laura: «No mires abajo. Mírame a mí. ...Vale, a mí tampoco, que me pongo nerviosa.»', 160, 40, 2000);
  }

  private finishMano(): void {
    this.score = Math.max(0, 8 - this.slips);
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

  private drawMano(): void {
    const b = this.bg;
    const t = this.t;
    // El río visto desde arriba: corre de izquierda a derecha.
    agua(b, 0, 30, BASE_WIDTH, 128, t, '#2a7c94', 1, 46);
    b.fillStyle(0x1c6478, 0.5).fillRect(0, 70, BASE_WIDTH, 50);
    for (let i = 0; i < 14; i++) {
      const lx = ((i * 61 + t * 70) % (BASE_WIDTH + 60)) - 30;
      b.fillStyle(0xe8f8f4, 0.55).fillRect(lx, 40 + ((i * 37) % 110), 14, 1).fillRect(lx + 4, 42 + ((i * 37) % 110), 6, 1);
    }
    // La orilla de abajo (piedritas) y la de arriba (pasto, helechos y selva).
    b.fillStyle(0xb8ae9c, 1).fillRect(0, 158, BASE_WIDTH, 22);
    for (let i = 0; i < 40; i++) b.fillStyle([0x9c9488, 0xc8c0b0, 0x8c8478][i % 3], 1).fillEllipse((i * 29) % BASE_WIDTH, 162 + ((i * 7) % 14), 6, 3);
    b.fillStyle(0xe8f8f4, 0.6).fillRect(0, 157, BASE_WIDTH, 1);
    b.fillStyle(0x4a8c3c, 1).fillRect(0, 0, BASE_WIDTH, 32);
    selva(b, 0, BASE_WIDTH, 2, '#2c6a34', 10, 6, t);
    for (let i = 0; i < 7; i++) helecho(b, 10 + i * 48, 32, 0.8, '#5aa04a', t);
    b.fillStyle(0xe8f8f4, 0.6).fillRect(0, 32, BASE_WIDTH, 1);
    // Las piedras.
    for (const s of this.stones) {
      const [x, y] = this.cell(s.x, s.y);
      const sunk = this.sunk(s);
      const wob = s.kind === 'floja' && !s.used ? Math.sin(t * 9 + s.off) * 1.5 : 0;
      b.fillStyle(0xe8f8f4, 0.7).fillEllipse(x - 12, y + 1, 6, 9);
      if (sunk) {
        b.fillStyle(0x5c8c94, 0.7).fillEllipse(x, y, 22, 11);
        b.lineStyle(1, 0xe8f8f4, 0.5).strokeEllipse(x, y, 24 + Math.sin(t * 5) * 2, 12);
      } else {
        roca(b, x + wob, y, 24, 12, s.kind === 'hunde' ? '#9c9a8c' : '#a09888', s.kind === 'firme');
        if (s.kind === 'floja' && !s.used) b.lineStyle(1, 0xf8e070, 0.7).strokeEllipse(x, y, 30 + Math.sin(t * 6) * 3, 15);
        if (s.kind === 'hunde' && Math.sin(t * 1.7 + s.off) < 0) b.lineStyle(1, 0x9cd0f0, 0.8).strokeEllipse(x, y, 28, 14);
      }
    }
    // Tú y Laura (sprites del juego), de la mano.
    const me = this.sprites.me;
    const la = this.sprites.laura;
    const k = this.hop / 0.2;
    const [tx, ty] = this.cell(this.col, Math.min(this.row, 9));
    const [fx, fy] = this.cell(this.lCol, Math.max(0, this.lRow));
    const mx = tx + (fx - tx) * k;
    const my = ty + (fy - ty) * k - Math.sin(k * Math.PI) * 8;
    me.setPosition(mx, my + 4);
    this.walkFrame(me, 'up', this.hop > 0);
    if (this.lRow >= 0) {
      const [lx, ly] = this.cell(this.lCol, this.lRow);
      const cur = la.x === 0 ? lx : la.x;
      la.setPosition(cur + (lx + 10 - cur) * 0.2, (la.y === 0 ? ly : la.y) + (ly + 14 - (la.y === 0 ? ly : la.y)) * 0.2);
    } else la.setPosition(mx + 10, 164);
    this.walkFrame(la, 'up', Math.abs(la.y - me.y) > 16);
    la.setDepth(la.y > me.y ? 21 : 19);
    if (this.grabQte > 0) la.setAngle(Math.sin(t * 30) * 8);
    else la.setAngle(0);
    me.setTint(this.slipFx > 0 ? 0x9cd0f0 : 0xffffff);
    if (this.together) manos(this.fg, me.x + 4, me.y - 10, la.x - 4, la.y - 10, this.laura.skin, 2);
    // El grupo en la otra orilla.
    for (const id of ['danilo_bano', 'mila_bano', 'fiorella', 'ariana']) {
      const s = this.sprites[id];
      if (s) s.setFrame(frameIndex('down', this.slipFx > 0.5 ? 1 : 0));
    }
    // Un pez que salta de vez en cuando.
    const jk = (t % 6) / 6;
    if (jk < 0.08) {
      const k2 = jk / 0.08;
      this.g.fillStyle(0xc8c0a8, 1).fillEllipse(250 + k2 * 30, 120 - Math.sin(k2 * Math.PI) * 14, 7, 3);
    }
    if (this.grabQte > 0) {
      tecla(this.hud, 294, 50, this.grabQte / 0.85, 0xff8aa8);
      this.keyText.setText('E').setPosition(294, 49);
    }
    this.infoText.setText(`Fila ${Math.min(8, this.row)}/8 · Resbalones: ${this.slips}`);
  }

  // -------------------------------------------------------------------------
  // Trucha
  // -------------------------------------------------------------------------

  private nibT = 0;
  private waitT = 0;
  private surge = 0;
  private surgeT = 0;
  private sacaT = 0;

  private static readonly TIP = { x: 92, y: 118 };

  private playTrucha(dt: number): void {
    if (this.tStep !== 'saca') this.tLeft -= dt;
    this.moveFish(dt);
    if (this.tStep === 'saca' && this.sacaT > 0) {
      // La trucha sale volando al balde; el resto espera a que termine.
      this.sacaT -= dt;
      if (this.sacaT > 0) return;
      this.tStep = 'apunta';
      if (this.caught === 1) this.say('Laura mete la trucha al balde. «¡Una! La próxima es mía. Bueno, la pescas tú, pero es mía.»', 270, 96, 2000);
    }
    if (this.tLeft <= 0 || this.caught >= 2) {
      this.score = this.caught;
      this.extra = this.lost;
      this.good = this.caught >= 2;
      this.perfect = this.caught >= 2 && this.lost === 0;
      this.together = this.caught >= 1;
      this.endGame(
        this.perfect
          ? 'Dos truchas arcoíris, una para cada uno, sin perder ni una. Don Efraín: «Ese chileno pesca como de aquí.» Laura las carga en el balde como si fueran trofeos.'
          : this.good
            ? 'Dos truchas en el balde. Laura: «La mía es la grande. No, no se discute.»'
            : `${this.caught === 1 ? 'Una trucha' : 'Ni una trucha'}. Don Efraín se ríe, mete la nasa y saca ${this.caught === 1 ? 'otra' : 'dos'} de una. «Pa\' que no se vayan con hambre, mijos.»`,
      );
      return;
    }
    if (this.tStep === 'apunta') {
      const sp = 95 * dt;
      if (Controls.isHeld('left')) this.aim.x -= sp;
      if (Controls.isHeld('right')) this.aim.x += sp;
      if (Controls.isHeld('up')) this.aim.y -= sp;
      if (Controls.isHeld('down')) this.aim.y += sp;
      this.aim.x = Phaser.Math.Clamp(this.aim.x, POND.x + 10, POND.x + POND.w - 10);
      this.aim.y = Phaser.Math.Clamp(this.aim.y, POND.y + 8, POND.y + POND.h - 8);
      this.bigText.setText('Apunta donde se ven las sombras · E: lanzar');
      if (Controls.consume('interact')) {
        this.tStep = 'lanza';
        this.bob = { x: this.aim.x, y: this.aim.y, dip: 0, fly: 0, fromX: PaseoScene.TIP.x, fromY: PaseoScene.TIP.y };
        playSfx('salto');
        this.bigText.setText('');
      }
    } else if (this.tStep === 'lanza') {
      this.bob.fly += dt / 0.5;
      if (this.bob.fly >= 1) {
        this.tStep = 'espera';
        this.waitT = 0;
        this.nibT = 0;
        playSfx('bump');
        this.parts.burst(this.bob.x, this.bob.y, 6, 0xe8f8f4, 30, 100, 0.4, 2);
        // La sombra más cercana se acerca (si está a tiro).
        const near = this.fish.filter((f) => f.state === 'nada').sort((a, b2) => Phaser.Math.Distance.Between(a.x, a.y, this.bob.x, this.bob.y) - Phaser.Math.Distance.Between(b2.x, b2.y, this.bob.x, this.bob.y))[0];
        if (near && Phaser.Math.Distance.Between(near.x, near.y, this.bob.x, this.bob.y) < 70) near.state = 'viene';
      }
    } else if (this.tStep === 'espera') {
      this.waitT += dt;
      this.bob.dip = Math.max(0, this.bob.dip - dt * 3);
      const biter = this.fish.find((f) => f.state === 'viene' || f.state === 'pica');
      if (!biter && this.waitT > 5) {
        const any = this.fish.find((f) => f.state === 'nada');
        if (any) any.state = 'viene';
      }
      if (biter?.state === 'pica') {
        if (this.biteWin > 0) {
          this.biteWin -= dt;
          if (this.biteWin <= 0) {
            biter.state = 'huye';
            biter.t = 2;
            this.say('Se comió la carnada y se fue. Don Efraín: «Esa era vieja, mijo. Esa sabe.»', 160, 40, 1700);
            this.tStep = 'apunta';
          }
        } else {
          this.nibT -= dt;
          if (this.nibT <= 0) {
            if (this.nibbles > 0) {
              this.nibbles--;
              this.bob.dip = 0.35;
              this.nibT = 0.5 + Math.random() * 0.9;
              playSfx('blip');
            } else {
              this.bob.dip = 1;
              this.biteWin = 0.6;
              playSfx('splash');
              this.pop('¡PICA!', '#f8e070', this.bob.x, this.bob.y - 20, 12);
            }
          }
        }
      }
      if (Controls.consume('interact')) {
        if (biter?.state === 'pica' && this.biteWin > 0) {
          this.hooked = biter;
          this.tStep = 'pelea';
          this.line = 1;
          this.tension = 0.25;
          this.surgeT = 1 + Math.random();
          this.biteWin = 0;
          playSfx('select');
          this.cameras.main.shake(120, 0.005);
          this.say(['Laura: «¡Tira, tira, tira!»', 'Laura: «¡Esa es grande! ¡No la sueltes!»'][this.caught] ?? 'Laura: «¡Vamos!»', 270, 96, 1400);
        } else if (biter) {
          biter.state = 'huye';
          biter.t = 2;
          this.pop('¡Muy pronto!', '#ff9c9c', this.bob.x, this.bob.y - 16, 9);
          this.say('Don Efraín: «Despacio, mijo. Esas primero prueban. Espere a que lo HUNDA.»', 160, 40, 1700);
          this.tStep = 'apunta';
        } else this.tStep = 'apunta';
      }
    } else if (this.tStep === 'pelea') {
      this.surgeT -= dt;
      if (this.surgeT <= 0) {
        this.surge = 0.7;
        this.surgeT = 1.1 + Math.random() * 1.5;
        this.parts.burst(this.bob.x, this.bob.y, 8, 0xe8f8f4, 40, 120, 0.5, 2);
        playSfx('splash');
      }
      this.surge = Math.max(0, this.surge - dt);
      const reel = Controls.isHeld('interact');
      if (reel) {
        this.line -= 0.32 * dt;
        this.tension += (0.34 + (this.surge > 0 ? 0.8 : 0)) * dt;
      } else {
        this.tension -= 0.6 * dt;
        this.line = Math.min(1, this.line + (this.surge > 0 ? 0.12 : 0.03) * dt);
      }
      this.tension = Math.max(0, this.tension);
      const f = this.hooked;
      if (f) {
        const tx = this.bob.fromX + (this.bob.x - this.bob.fromX) * this.line;
        const ty = Math.min(POND.y + POND.h - 6, this.bob.fromY + (this.bob.y - this.bob.fromY) * this.line);
        f.x += (tx + Math.sin(this.t * 7) * 10 - f.x) * Math.min(1, dt * 5);
        f.y += (ty - f.y) * Math.min(1, dt * 5);
      }
      if (this.tension >= 1) {
        this.lost++;
        if (f) {
          f.state = 'huye';
          f.t = 3;
        }
        this.hooked = null;
        playSfx('error');
        this.cameras.main.shake(160, 0.008);
        this.pop('¡Se reventó el nylon!', '#ff9c9c', 160, 70);
        this.say('Don Efraín amarra otro anzuelo sin decir nada. Laura: «Tranquilo. Hay más truchas en el estanque.»', 160, 40, 1800);
        this.tStep = 'apunta';
      } else if (this.line <= 0) {
        this.caught++;
        this.fish = this.fish.filter((x) => x !== f);
        this.hooked = null;
        this.tStep = 'saca';
        this.sacaT = 1.6;
        playSfx('item');
        this.parts.burst(PaseoScene.TIP.x + 20, POND.y + POND.h, 16, 0xe8f8f4, 70, 200, 0.7, 2);
        this.pop(this.caught === 1 ? '¡Una trucha arcoíris!' : '¡La segunda!', '#f8e070', 160, 60);
      }
    }
  }

  private moveFish(dt: number): void {
    for (const f of this.fish) {
      if (f === this.hooked) continue;
      f.t -= dt;
      if (f.state === 'viene') {
        const dx = this.bob.x - f.x;
        const dy = this.bob.y - f.y;
        const d = Math.hypot(dx, dy);
        if (this.tStep !== 'espera') f.state = 'nada';
        else if (d < 7) {
          f.state = 'pica';
          this.nibbles = Math.floor(Math.random() * 3);
          this.nibT = 0.5 + Math.random() * 0.8;
          this.biteWin = 0;
        } else {
          f.vx = (dx / d) * 22;
          f.vy = (dy / d) * 22;
        }
      } else if (f.state === 'pica') {
        f.vx = Math.sin(this.t * 4) * 4;
        f.vy = 0;
        if (this.tStep !== 'espera') f.state = 'nada';
      } else {
        if (f.state === 'huye' && f.t <= 0) f.state = 'nada';
        if (Math.random() < dt * 0.8) {
          f.vx += (Math.random() - 0.5) * 24;
          f.vy += (Math.random() - 0.5) * 12;
        }
        const max = f.state === 'huye' ? 45 : 16;
        const sp = Math.hypot(f.vx, f.vy);
        if (sp > max) {
          f.vx *= max / sp;
          f.vy *= max / sp;
        }
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < POND.x + 10 || f.x > POND.x + POND.w - 10) f.vx *= -1;
      if (f.y < POND.y + 8 || f.y > POND.y + POND.h - 8) f.vy *= -1;
      f.x = Phaser.Math.Clamp(f.x, POND.x + 10, POND.x + POND.w - 10);
      f.y = Phaser.Math.Clamp(f.y, POND.y + 8, POND.y + POND.h - 8);
    }
  }

  private drawTrucha(): void {
    const b = this.bg;
    const g = this.g;
    const t = this.t;
    // El potrero, las guaduas y el ranchito de don Efraín.
    b.fillStyle(0x5a9c4a, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let i = 0; i < 70; i++) b.fillStyle(i % 2 ? 0x6aac54 : 0x4c8c40, 1).fillRect((i * 47) % BASE_WIDTH, (i * 29) % BASE_HEIGHT, 3, 2);
    selva(b, 0, BASE_WIDTH, 6, '#2c6a34', 12, 8, t);
    for (let i = 0; i < 7; i++) guadua(b, 8 + i * 46 + (i % 2) * 12, 42, 30 + (i % 3) * 6, Math.sin(t * 1.3 + i) * 2);
    b.fillStyle(0x2a2433, 1).fillRect(270, 16, 44, 30);
    b.fillStyle(0xf4f0e6, 1).fillRect(271, 22, 42, 23);
    b.fillStyle(0x9c4428, 1).fillTriangle(266, 24, 292, 8, 318, 24);
    b.fillStyle(0x6a4428, 1).fillRect(278, 30, 8, 15);
    b.fillStyle(0x2c64c0, 1).fillRect(292, 28, 14, 8);
    b.fillStyle(0xf4f0e6, 1).fillRect(294, 30, 10, 1).fillRect(294, 33, 7, 1);
    this.body(g, look('efren', this.me), 296, 56, 0.6, { mouth: this.tStep === 'pelea' ? 'grin' : 'smile' });
    // El estanque: borde de cemento, agua verde y el chorrito que entra.
    b.fillStyle(0x2a2433, 1).fillRoundedRect(POND.x - 7, POND.y - 7, POND.w + 14, POND.h + 14, 8);
    b.fillStyle(0xb8b4a8, 1).fillRoundedRect(POND.x - 6, POND.y - 6, POND.w + 12, POND.h + 12, 7);
    b.fillStyle(0xd0ccc0, 1).fillRect(POND.x - 4, POND.y - 6, POND.w + 8, 2);
    agua(b, POND.x, POND.y, POND.w, POND.h, t, '#2a6a6c', -1, 6);
    b.fillStyle(0x1c4c50, 0.5).fillRect(POND.x + 20, POND.y + 20, POND.w - 40, POND.h - 34);
    b.fillStyle(0x6c6c74, 1).fillRect(POND.x + POND.w - 30, POND.y - 12, 6, 12);
    b.fillStyle(0xd8eef4, 0.9).fillRect(POND.x + POND.w - 29, POND.y - 2, 4, 10);
    if (Math.random() < 0.5) this.parts.add({ x: POND.x + POND.w - 27, y: POND.y + 8, vx: (Math.random() - 0.5) * 20, vy: -15, life: 0.4, color: 0xe8f8f4, size: 2 });
    // Las truchas: sombras que nadan.
    for (const f of this.fish) {
      const dir = f.vx >= 0 ? 1 : -1;
      const w = 14 * f.size;
      const col = f === this.hooked ? 0x3c4c48 : 0x183c3c;
      g.fillStyle(col, f === this.hooked ? 0.95 : 0.75).fillEllipse(f.x, f.y, w, 5 * f.size);
      g.fillTriangle(f.x - dir * w * 0.45, f.y, f.x - dir * (w * 0.75), f.y - 3, f.x - dir * (w * 0.75), f.y + 3);
      if (f === this.hooked) g.fillStyle(0xe87878, 0.8).fillRect(f.x - 3, f.y - 1, 6, 1);
    }
    // El jugador con la caña (abajo a la izquierda) y Laura con el balde.
    const fishing = this.tStep !== 'apunta';
    this.body(g, this.meBano, 48, 108, 1.05, { pose: 'cana', mouth: this.tStep === 'pelea' ? 'teeth' : 'smile', mojado: true });
    const tip = PaseoScene.TIP;
    const bend = this.tStep === 'pelea' ? this.tension * 10 : 0;
    g.lineStyle(2, 0x2a2433, 1).lineBetween(60, 124, tip.x, tip.y + bend);
    g.lineStyle(1, 0x8c6a44, 1).lineBetween(60, 123, tip.x, tip.y + bend - 1);
    // El nylon y el corcho.
    const bob = this.bob;
    let bx = bob.x;
    let by = bob.y;
    if (this.tStep === 'lanza') {
      bx = bob.fromX + (bob.x - bob.fromX) * bob.fly;
      by = bob.fromY + (bob.y - bob.fromY) * bob.fly - Math.sin(bob.fly * Math.PI) * 30;
    } else if (this.tStep === 'pelea' && this.hooked) {
      bx = this.hooked.x;
      by = this.hooked.y;
    }
    if (fishing && this.tStep !== 'saca') {
      const color = this.tStep === 'pelea' && this.tension > 0.75 ? 0xff5a5a : 0xe8e8e0;
      const sag = this.tStep === 'pelea' ? 2 : 10;
      let px = tip.x;
      let py = tip.y + bend;
      for (let i = 1; i <= 8; i++) {
        const k = i / 8;
        const x = tip.x + (bx - tip.x) * k;
        const y = tip.y + bend + (by - tip.y - bend) * k + Math.sin(k * Math.PI) * sag;
        g.lineStyle(1, color, 0.9).lineBetween(px, py, x, y);
        px = x;
        py = y;
      }
      const dip = bob.dip * 3;
      g.fillStyle(0xf4f0e6, 1).fillCircle(bx, by + dip, 3);
      g.fillStyle(0xd83c30, 1).fillRect(bx - 3, by + dip - 3, 6, 3);
      if (this.tStep === 'espera') g.lineStyle(1, 0xe8f8f4, 0.6).strokeEllipse(bx, by + 2, 10 + bob.dip * 10 + Math.sin(t * 3) * 2, 3 + bob.dip * 3);
    }
    if (this.tStep === 'saca') {
      const k = 1 - this.sacaT / 1.6;
      const fx2 = 110 + k * 160;
      const fy2 = 130 - Math.sin(Math.min(1, k * 1.4) * Math.PI) * 50;
      g.fillStyle(0x2a2433, 1).fillEllipse(fx2, fy2, 22, 9);
      g.fillStyle(0x9cb4a8, 1).fillEllipse(fx2, fy2, 20, 7);
      g.fillStyle(0xe87878, 1).fillRect(fx2 - 7, fy2 - 1, 14, 2);
      g.fillStyle(0x9cb4a8, 1).fillTriangle(fx2 + 9, fy2, fx2 + 15, fy2 - 4, fx2 + 15, fy2 + 4);
      g.fillStyle(0x2a2433, 1).fillRect(fx2 - 7, fy2 - 2, 1, 1);
    }
    this.body(g, this.laura, 290, 110, 1.05, { pose: this.tStep === 'pelea' || this.tStep === 'saca' ? 'arriba' : 'quieto', mouth: this.tStep === 'pelea' ? 'open' : 'smile', mojado: true });
    // El balde con las truchas.
    g.fillStyle(0x2a2433, 1).fillRect(256, 140, 20, 18);
    g.fillStyle(0x4a7ad8, 1).fillRect(257, 141, 18, 16);
    g.fillStyle(0x2a7c94, 1).fillRect(258, 142, 16, 4);
    for (let i = 0; i < this.caught; i++) g.fillStyle(0x9cb4a8, 1).fillEllipse(262 + i * 8, 140, 8, 3);
    // La mira.
    if (this.phase === 'play' && this.tStep === 'apunta') {
      const a = this.aim;
      this.hud.lineStyle(1, 0xf8e070, 1).strokeCircle(a.x, a.y, 7 + Math.sin(t * 6));
      this.hud.lineBetween(a.x - 11, a.y, a.x - 5, a.y).lineBetween(a.x + 5, a.y, a.x + 11, a.y).lineBetween(a.x, a.y - 11, a.x, a.y - 5).lineBetween(a.x, a.y + 5, a.x, a.y + 11);
    }
    if (this.tStep === 'pelea') {
      this.meter(110, 160, 100, this.tension, this.tension > 0.75 ? 0xe85a64 : this.tension > 0.5 ? 0xf8e070 : 0x58c858, 'Nylon (suelta E si se pone rojo)');
      this.meter(110, 26, 100, 1 - this.line, 0x58d4d0, 'Recoger');
    }
    if (this.tStep === 'espera' && this.biteWin > 0) {
      tecla(this.hud, 294, 64, this.biteWin / 0.6, 0xf8e070);
      this.keyText.setText('E').setPosition(294, 63);
    }
    this.infoText.setText(`Truchas: ${this.caught}/2 · ${Math.max(0, Math.ceil(this.tLeft))} s`);
  }

  // -------------------------------------------------------------------------
  // Subida
  // -------------------------------------------------------------------------

  private handFx = 0;
  private static readonly GOAL = 24;

  private nextPrompt(): void {
    const needHand = (this.climbed === 6 || this.climbed === 13 || this.climbed === 20) && this.gaveHand < this.climbed;
    if (needHand) {
      this.gaveHand = this.climbed;
      this.prompt = 'mano';
      this.promptMax = 1.6;
      this.say('Laura: «¿Me ayudas? Aquí no llego.» (E)', 150, 60, 1500);
    } else {
      let k: Key = KEYS[Math.floor(Math.random() * KEYS.length)];
      if (k === this.prompt) k = KEYS[(KEYS.indexOf(k) + 1) % 4];
      this.prompt = k;
      this.promptMax = Math.max(0.65, 1.4 - this.climbed * 0.03);
    }
    this.promptMs = this.promptMax;
  }

  private playSubida(dt: number): void {
    this.stepFx = Math.max(0, this.stepFx - dt);
    this.handFx = Math.max(0, this.handFx - dt);
    if (this.t > 80 && this.climbed < PaseoScene.GOAL) {
      // Nadie se queda a mitad de la loma: Danilo baja a buscarlos.
      this.prompt = null;
      this.score = this.climbed;
      this.together = this.handsGiven >= 2;
      this.good = false;
      this.perfect = false;
      this.endGame('Danilo baja a buscarlos con una rama de bastón. «¡Vamos, abuelitos!» Llegan arriba empujados, muertos de risa.');
      return;
    }
    if (this.restMs > 0) {
      this.restMs -= dt;
      if (this.restMs <= 0) this.nextPrompt();
      return;
    }
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
    if (hit === null) return;
    if (hit) {
      this.climbed++;
      this.stepFx = 0.25;
      if (p === 'mano') {
        this.handsGiven++;
        this.handFx = 1.2;
        playSfx('latido');
        this.pop('♥', '#ff8aa8', 150, 80, 14);
      } else {
        playSfx('cursor');
        if (this.promptMs > this.promptMax * 0.6) this.pop('¡Rápido!', '#a8e0a0', 200, 70, 8);
      }
    } else {
      this.misses++;
      if (p === 'mano') this.say('Laura sube sola, a como puede. «Vale, gracias, ¿eh?»', 150, 60, 1400);
      else {
        this.climbed = Math.max(0, this.climbed - 1);
        playSfx('bump');
        this.pop('resbalón', '#ff9c9c', 180, 90, 9);
        this.parts.burst(180, 112, 8, 0x7a5a38, 40, 160, 0.5, 2);
      }
    }
    if (this.climbed >= PaseoScene.GOAL) {
      this.prompt = null;
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
    if (hit && (this.climbed === 8 || this.climbed === 16) && p !== 'mano') {
      this.prompt = null;
      this.restMs = 2.2;
      this.say(this.climbed === 8 ? 'Laura (sin aire): «Un segundo... Un segundito. Que me muero. ...Vale. Mira eso.»' : 'Pasa un señor bajando con un racimo de plátanos al hombro, silbando. Ni sudado. Laura: «Odio a ese señor.»', 160, 46, 2100);
      return;
    }
    this.nextPrompt();
  }

  private drawSubida(): void {
    const b = this.bg;
    const g = this.g;
    const t = this.t;
    const k = this.climbed / PaseoScene.GOAL;
    // Al subir, el valle aparece abajo y Cali a lo lejos.
    cielo(b, 0, 0, BASE_WIDTH, 100, '#5ca0dc', '#d8ecf4');
    nubes(b, BASE_WIDTH, t, 20, 4, 0.85, 3);
    const drop = k * 30;
    cordillera(b, -20, BASE_WIDTH + 40, 70 + drop * 0.3, 34, '#7896ac', 4);
    b.fillStyle(0x6a9c5a, 1).fillRect(0, 70 + drop * 0.3, BASE_WIDTH, 120);
    b.lineStyle(2, 0xc8e4f0, 0.9);
    b.beginPath().moveTo(0, 96 + drop * 0.6).lineTo(70, 88 + drop * 0.6).lineTo(140, 94 + drop * 0.6).lineTo(BASE_WIDTH, 84 + drop * 0.6).strokePath();
    if (k > 0.4) {
      const a = Math.min(1, (k - 0.4) * 2);
      for (let i = 0; i < 14; i++) b.fillStyle(0xd8d4cc, 0.6 * a).fillRect(230 + (i % 7) * 7, 74 + drop * 0.3 - Math.floor(i / 7) * 4 - (i % 3) * 2, 5, 4 + (i % 3) * 2);
      b.fillStyle(0xe0e8f0, 0.25 * a).fillRect(200, 66 + drop * 0.3, 120, 14);
    }
    selva(b, 0, BASE_WIDTH, 104 + drop, '#3c7a3c', 12, 2, t);
    // La loma: una diagonal con escalones de barro, raíces y helechos que bajan al subir.
    const ground = (x: number): number => 186 - x * 0.36;
    b.fillStyle(0x2c5a2c, 1).fillPoints([{ x: 0, y: 186 }, { x: BASE_WIDTH, y: ground(BASE_WIDTH) }, { x: BASE_WIDTH, y: 180 }, { x: 0, y: 180 }], true);
    b.fillStyle(0x7a5a38, 1).fillPoints([{ x: 0, y: 182 }, { x: BASE_WIDTH, y: ground(BASE_WIDTH) - 4 }, { x: BASE_WIDTH, y: ground(BASE_WIDTH) + 6 }, { x: 0, y: 192 }], true);
    const scroll = this.climbed * 22 + (0.25 - this.stepFx) * 88 * (this.stepFx > 0 ? 1 : 0);
    for (let i = 0; i < 10; i++) {
      const x = ((i * 40 - scroll) % 400 + 400) % 400 - 40;
      const y = ground(x);
      b.fillStyle(0x5a3e24, 1).fillRect(x, y - 2, 14, 3);
      b.fillStyle(0x8c6a44, 1).fillRect(x, y - 3, 14, 1);
      helecho(b, x + 26, y + 6, 0.9, i % 2 ? '#3c8c3c' : '#4c9c48', t);
    }
    for (let i = 0; i < 4; i++) {
      const x = ((i * 100 + 50 - scroll * 0.9) % 400 + 400) % 400 - 40;
      b.fillStyle(0x4a3422, 1).fillRect(x, ground(x) - 60, 6, 58);
      b.fillStyle(0x2c6a34, 1).fillCircle(x + 3, ground(x) - 66, 18);
      b.fillStyle(0x3c8040, 1).fillCircle(x - 4, ground(x) - 72, 9);
    }
    // Los dos subiendo (tú adelante, Laura atrás).
    const paso = Math.floor(this.climbed) % 2;
    const mx = 178;
    const lx = 146;
    const reach = this.prompt === 'mano' || this.handFx > 0;
    this.body(g, this.me, mx, ground(mx) - 36, 1, { pose: reach ? 'mano_izq' : 'camina', paso, mouth: this.stepFx > 0 ? 'teeth' : 'smile' });
    this.body(g, this.laura, lx, ground(lx) - 35, 1, { pose: reach ? 'mano_der' : 'camina', paso: 1 - paso, mouth: this.prompt === 'mano' ? 'o' : this.handFx > 0 ? 'smile' : 'open', blush: this.handsGiven > 1 });
    if (this.handFx > 0) manos(g, lx + 16, ground(lx) - 22, mx - 16, ground(mx) - 24, this.laura.skin, 2);
    // El altímetro.
    const h = this.hud;
    h.fillStyle(0x0c1020, 0.8).fillRoundedRect(8, 24, 12, 120, 4);
    h.fillStyle(0x58c858, 1).fillRect(10, 26 + 116 * (1 - k), 8, 116 * k);
    this.hudLabel(`${Math.round(1540 + k * 210)} m`, 24, 26 + 116 * (1 - k) - 4);
    // La tecla.
    if (this.prompt && this.phase === 'play') {
      const kk = this.promptMs / Math.max(0.1, this.promptMax);
      const color = this.prompt === 'mano' ? 0xf8a0b8 : KEY_COLOR[this.prompt];
      tecla(h, 286, 60, kk, color);
      this.keyText.setText(this.prompt === 'mano' ? 'E' : KEY_LABEL[this.prompt]).setPosition(286, 59);
      if (this.prompt === 'mano') this.bigText.setText('¡E: la mano!');
      else this.bigText.setText('');
    } else if (this.phase === 'play') this.bigText.setText('');
    this.infoText.setText(`Subida: ${Math.round(k * 100)}% · Manos: ${this.handsGiven}`);
  }

  // -------------------------------------------------------------------------
  // Bajada
  // -------------------------------------------------------------------------

  private static readonly PY = 70;

  private playBajada(dt: number): void {
    const DIST = 64;
    if (Controls.consume('left')) this.lane = Math.max(0, this.lane - 1);
    if (Controls.consume('right')) this.lane = Math.min(2, this.lane + 1);
    if (Controls.consume('up') && this.jumping <= 0) {
      this.jumping = 0.5;
      playSfx('salto');
    }
    this.jumping = Math.max(0, this.jumping - dt);
    this.braking = Controls.isHeld('down') && this.jumping <= 0;
    const speed = this.braking ? 22 : 34;
    this.dist += (speed / 10) * dt;
    this.sunset = Math.min(1, this.dist / DIST);
    this.laneX += (120 + this.lane * 40 - this.laneX) * Math.min(1, dt * 12);
    this.spawnMs -= dt;
    if (this.spawnMs <= 0) {
      const r = Math.random();
      const kind: Obstacle['kind'] = r < 0.42 ? 'barro' : r < 0.78 ? 'piedra' : 'raiz';
      this.obstacles.push({ kind, lane: kind === 'raiz' ? -1 : Math.floor(Math.random() * 3), y: BASE_HEIGHT + 16, hit: false });
      this.spawnMs = Math.max(0.75, 1.3 - this.sunset * 0.4) + Math.random() * 0.7;
    }
    const PY = PaseoScene.PY;
    for (const o of this.obstacles) {
      o.y -= speed * dt * 2.4;
      const there = o.lane === -1 || o.lane === this.lane;
      if (!o.hit && o.y < PY + 6 && o.y > PY - 6 && there) {
        o.hit = true;
        if (o.kind === 'piedra') {
          this.misses++;
          playSfx('golpe');
          this.cameras.main.shake(140, 0.006);
          this.say('Tropiezas. Laura te sujeta: «¡Ey! Que te tengo.»', 160, 110, 1300);
        } else if (o.kind === 'raiz') {
          if (this.jumping > 0) {
            this.score++;
            this.pop('¡Hop!', '#a8e0a0', this.laneX, PY - 26, 9);
          } else {
            this.misses++;
            playSfx('golpe');
            this.say('Te enredas en una raíz. Laura casi se cae encima tuyo. «¡Pies, chileno, PIES!»', 160, 110, 1400);
          }
        } else if (!this.braking) {
          this.misses++;
          playSfx('chapuzon');
          this.parts.burst(this.laneX, PY, 14, 0x5a3c20, 60, 160, 0.6, 3);
          this.say('Patinan en el barro y se van los dos al suelo. Se ríen hasta que les duele.', 160, 110, 1600);
        } else {
          this.score++;
          this.pop('¡Frenado!', '#a8e0a0', this.laneX, PY - 26, 9);
        }
      } else if (!o.hit && o.y < PY - 6) {
        o.hit = true;
        if (o.kind !== 'barro' || !there) this.score++;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.y > -20);
    if (this.sunset > 0.55 && Math.random() < dt * 6) this.parts.add({ x: Math.random() * BASE_WIDTH, y: 30 + Math.random() * 140, vx: (Math.random() - 0.5) * 10, vy: -4, life: 1.6, color: 0xf8f070, size: 2, shrink: false, round: true });
    if (Math.floor(this.dist) === 32 && Math.floor(this.dist - (speed / 10) * dt) === 31) {
      this.say('Laura: «¿Sabes qué? Hoy ha sido de los mejores días desde que llegué. Y no lo digo por el río.»', 160, 110, 3000);
    }
    this.infoText.setText(`Bajada: ${Math.round(this.sunset * 100)}% · Caídas: ${this.misses}`);
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

  private drawBajada(): void {
    const b = this.bg;
    const g = this.g;
    const t = this.t;
    const s = this.sunset;
    const scroll = this.dist * 24;
    // El monte visto desde arriba: el sendero de tierra y la selva a los lados.
    b.fillStyle(mixColor('#3c7a3c', '#3a4a3c', s), 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    b.fillStyle(mixColor('#8c6a44', '#6a4c3c', s), 1).fillRect(96, 0, 128, BASE_HEIGHT);
    b.fillStyle(mixColor('#7a5a38', '#5a3c30', s), 1).fillRect(96, 0, 4, BASE_HEIGHT).fillRect(220, 0, 4, BASE_HEIGHT);
    for (let i = 0; i < 26; i++) {
      const y = ((i * 31 - scroll) % 200 + 200) % 200 - 10;
      b.fillStyle(0x6a4c30, 1).fillRect(100 + ((i * 41) % 116), y, 5, 2);
    }
    for (let i = 0; i < 12; i++) {
      const y = ((i * 46 - scroll * 1.05) % 230 + 230) % 230 - 25;
      for (const x of [i % 2 ? 28 : 52, i % 2 ? 262 : 290]) {
        b.fillStyle(0x1c3c20, 0.6).fillCircle(x + 6, y + 6, 22);
        b.fillStyle(mixColor('#2c6a34', '#2c4430', s), 1).fillCircle(x, y, 20);
        b.fillStyle(mixColor('#4c8c40', '#5a5a3c', s), 1).fillCircle(x - 6, y - 6, 9);
      }
      helecho(b, i % 2 ? 84 : 236, y + 20, 0.8, '#4c9c48', t);
    }
    // Los obstáculos (suben hacia ustedes).
    const lx = (l: number): number => 120 + l * 40;
    for (const o of this.obstacles) {
      if (o.kind === 'barro') {
        g.fillStyle(0x4a3018, 1).fillEllipse(lx(o.lane), o.y, 30, 12);
        g.fillStyle(0x6a4a2c, 1).fillEllipse(lx(o.lane) - 3, o.y - 1, 18, 5);
        g.fillStyle(0x9cc8d8, 0.5).fillEllipse(lx(o.lane) + 5, o.y, 8, 2);
      } else if (o.kind === 'piedra') roca(g, lx(o.lane), o.y, 18, 13, '#9c968c');
      else {
        g.lineStyle(4, 0x3a2414, 1);
        g.beginPath().moveTo(96, o.y).lineTo(130, o.y - 3).lineTo(160, o.y + 2).lineTo(190, o.y - 2).lineTo(224, o.y + 1).strokePath();
        g.lineStyle(2, 0x6a4428, 1).lineBetween(100, o.y - 1, 220, o.y - 1);
      }
    }
    // Ustedes dos (sprites del juego), de la mano, con la sombra larga del atardecer.
    const me = this.sprites.me;
    const la = this.sprites.laura;
    const jy = this.jumping > 0 ? -Math.sin((this.jumping / 0.5) * Math.PI) * 10 : 0;
    const PY = PaseoScene.PY;
    for (const x of [this.laneX - 12, this.laneX + 12]) b.fillStyle(0x14182a, 0.3).fillEllipse(x + 4 + s * 12, PY + 2, 18 + s * 20, 6);
    me.setPosition(this.laneX - 12, PY + jy);
    la.setPosition(this.laneX + 12, PY + jy * 0.9);
    this.walkFrame(me, 'down', this.phase === 'play', this.braking ? 5 : 9);
    this.walkFrame(la, 'down', this.phase === 'play', this.braking ? 5 : 9);
    manos(this.fg, this.laneX - 5, PY - 13 + jy, this.laneX + 5, PY - 13 + jy, this.laura.skin, 2);
    // El atardecer encima de todo.
    this.fg.fillStyle(0xf8904c, s * 0.22).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    this.fg.fillStyle(0x3c2c5c, Math.max(0, s - 0.7) * 0.6).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let i = 0; i < 3; i++) this.fg.fillStyle(0xfff0c0, 0.05 + s * 0.05).fillTriangle(320, 0, 320 - 60 - i * 60, 0, 120 - i * 80, 180);
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
      if (this.press > 1 || this.press < 0) {
        this.pressDir *= -1;
        this.press = Phaser.Math.Clamp(this.press, 0, 1);
      }
      this.bigText.setText(`Carne ${this.pressed + 1} de 2: E en el grosor justo`);
      if (Controls.consume('interact')) {
        const ok = this.press > 0.42 && this.press < 0.62;
        if (ok) {
          this.score++;
          this.pop('¡Justa!', '#a8e0a0', 160, 96);
        } else {
          this.misses++;
          this.pop(this.press < 0.42 ? 'Muy gorda' : 'Muy delgada', '#ff9c9c', 160, 96);
        }
        playSfx('sarten');
        this.parts.burst(160, 126, 6, 0xb85848, 30, 120, 0.4, 2);
        this.patties.push({ cook: 0, side: 0, done: false, burnt: false });
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
      this.patties.forEach((p, i) => {
        if (p.done) return;
        p.cook += dt * 0.22;
        if (Math.random() < dt * 8) this.parts.add({ x: 120 + i * 80 + (Math.random() - 0.5) * 30, y: 108, vx: (Math.random() - 0.5) * 30, vy: -50, life: 0.3, color: 0xf8e8a8, size: 1, grav: 200 });
        if (Math.random() < dt * (p.cook > 1.1 ? 10 : 3)) this.parts.add({ x: 120 + i * 80 + (Math.random() - 0.5) * 20, y: 104, vy: -20, life: 1.2, color: p.cook > 1.1 ? 0x5a5a5a : 0xe8e8e8, size: 5, round: true });
        if (p.cook > 1.25 && !p.burnt) {
          p.burnt = true;
          this.misses++;
          this.say('Huele a quemado. Abres la ventana. Nadie tiene por qué enterarse.', 160, 40, 1500);
        }
        if (p.burnt && p.cook > 1.9) {
          // La sacas de la plancha antes de que se haga carbón.
          p.done = true;
          playSfx('sarten');
        }
      });
      if (Controls.consume('interact')) {
        const p = this.patties[this.sel];
        if (!p.done) {
          playSfx('sarten');
          const ok = p.cook > 0.7 && p.cook < 1.1;
          if (ok) {
            this.score++;
            this.pop('¡Dorada!', '#a8e0a0', this.sel === 0 ? 120 : 200, 86);
          } else if (!p.burnt) {
            this.misses++;
            this.pop(p.cook <= 0.7 ? 'Cruda todavía' : 'Pasada', '#ff9c9c', this.sel === 0 ? 120 : 200, 86);
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
        this.pop('Esa no va ahí', '#ff9c9c', 160, 70, 9);
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

  private drawBurger(): void {
    const b = this.bg;
    const g = this.g;
    const t = this.t;
    // La cocina del 805: baldosas, la ventana con Cali de noche y la luna, el mesón de madera.
    b.fillStyle(0xe8e0d0, 1).fillRect(0, 0, BASE_WIDTH, 110);
    for (let y = 0; y < 110; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < BASE_WIDTH; x += 10) b.fillStyle(0xdcd2c0, 1).fillRect(x, y, 9, 9);
    b.fillStyle(0x2a2433, 1).fillRect(214, 16, 96, 58);
    cielo(b, 216, 18, 92, 54, '#0c1430', '#2a3456', 5);
    for (let i = 0; i < 40; i++) b.fillStyle([0xf8dc68, 0xf8f4ec, 0xe8a040][i % 3], 0.85).fillRect(218 + ((i * 17) % 88), 50 + ((i * 7) % 20), 1, 1);
    b.fillStyle(0xf4f0e0, 1).fillCircle(290, 30, 6);
    b.fillStyle(0x2a2433, 1).fillRect(260, 16, 2, 58).fillRect(214, 44, 96, 2);
    b.fillStyle(0x8c6a48, 1).fillRect(0, 110, BASE_WIDTH, BASE_HEIGHT - 110);
    b.fillStyle(0xa8845c, 1).fillRect(0, 110, BASE_WIDTH, 4);
    for (let i = 0; i < 12; i++) b.fillStyle(0x7a5a3c, 1).fillRect((i * 53) % BASE_WIDTH, 120 + ((i * 13) % 50), 30, 1);
    if (this.bStep === 'aplastar') {
      const h = 6 + (1 - this.press) * 22;
      g.fillStyle(0xf4f0e6, 1).fillEllipse(160, 132, 110, 22);
      g.fillStyle(0x2a2433, 1).fillEllipse(160, 126, 60 + this.press * 30, h + 2);
      g.fillStyle(0xb85848, 1).fillEllipse(160, 125, 58 + this.press * 30, h);
      g.fillStyle(0xd8786c, 1).fillEllipse(152, 122 - h * 0.2, 20 + this.press * 10, Math.max(2, h * 0.3));
      // La mano con la tapa del tarro, que aplasta.
      const hy = 125 - h / 2 - 14;
      g.fillStyle(0x2a2433, 1).fillRect(130, hy, 60, 8);
      g.fillStyle(0xc8ccd4, 1).fillRect(131, hy + 1, 58, 6);
      g.fillStyle(0x2a2433, 1).fillRect(150, hy - 14, 20, 15);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(this.me.skin).color, 1).fillRect(151, hy - 13, 18, 13);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(this.me.shirt).color, 1).fillRect(151, hy - 40, 18, 27);
      this.meter(60, 42, 200, this.press, 0xf8e070);
      this.hud.fillStyle(0x58c858, 1).fillRect(60 + 200 * 0.42, 42, 200 * 0.2, 5);
      this.hud.fillStyle(0xf8e070, 1).fillRect(60 + 200 * this.press - 1, 39, 3, 11);
    } else if (this.bStep === 'plancha') {
      // La estufa con la llama y la plancha de hierro.
      g.fillStyle(0x2a2a30, 1).fillRect(60, 120, 200, 30);
      for (let i = 0; i < 2; i++) {
        for (let k = 0; k < 6; k++) g.fillStyle(k % 2 ? 0x4a9ad8 : 0xf8a040, 0.9).fillTriangle(100 + i * 80 + k * 6, 122, 103 + i * 80 + k * 6, 114 - Math.abs(Math.sin(t * 12 + k)) * 4, 106 + i * 80 + k * 6, 122);
      }
      g.fillStyle(0x14141a, 1).fillRoundedRect(70, 100, 180, 20, 4);
      g.fillStyle(0x3a3a44, 1).fillRect(74, 102, 172, 3);
      this.patties.forEach((p, i) => {
        const x = 120 + i * 80;
        const c = p.burnt ? 0x1c1414 : p.cook > 0.7 ? 0x6a3c24 : p.cook > 0.35 ? 0x8c4c34 : 0xb85848;
        if (this.sel === i) g.lineStyle(2, 0xf8e070, 1).strokeEllipse(x, 106, 54, 18);
        g.fillStyle(0x2a2433, 1).fillEllipse(x, 107, 48, 15);
        g.fillStyle(c, 1).fillEllipse(x, 106, 46, 13);
        for (let k = 0; k < 4; k++) g.fillStyle(0x2a1c14, 0.4).fillRect(x - 14 + k * 9, 103 + (k % 2) * 3, 4, 1);
        this.meter(x - 24, 140, 48, p.cook / 1.25, p.cook > 0.7 && p.cook < 1.1 ? 0x58c858 : p.cook >= 1.1 ? 0xe85a64 : 0xe8903c, p.done ? 'Lista' : p.side === 0 ? 'Lado 1' : 'Lado 2');
      });
    } else {
      // El plato y las capas.
      g.fillStyle(0x2a2433, 1).fillEllipse(130, 152, 104, 22);
      g.fillStyle(0xf4f0e6, 1).fillEllipse(130, 150, 100, 18);
      let y = 146;
      this.stack.forEach((c, i) => {
        const top = i === RECETA.length - 1;
        if (c === 'pan') {
          if (top) {
            g.fillStyle(0x2a2433, 1).fillEllipse(130, y - 6, 66, 22);
            g.fillStyle(0xd8a050, 1).fillEllipse(130, y - 6, 64, 20);
            g.fillStyle(0xe8b868, 1).fillEllipse(124, y - 10, 40, 8);
            for (let k = 0; k < 7; k++) g.fillStyle(0xf8f0d8, 1).fillRect(112 + k * 6, y - 12 + (k % 2) * 3, 2, 1);
          } else {
            g.fillStyle(0x2a2433, 1).fillRoundedRect(98, y - 6, 64, 10, 4);
            g.fillStyle(0xd8a050, 1).fillRoundedRect(99, y - 5, 62, 8, 3);
          }
          y -= 8;
        } else if (c === 'lechuga') {
          for (let k = 0; k < 8; k++) g.fillStyle(k % 2 ? 0x58b848 : 0x78d058, 1).fillEllipse(102 + k * 8, y - 1 + (k % 2), 12, 6);
          y -= 4;
        } else if (c === 'carne') {
          g.fillStyle(0x2a2433, 1).fillRoundedRect(100, y - 8, 60, 10, 4);
          g.fillStyle(0x6a3c24, 1).fillRoundedRect(101, y - 7, 58, 8, 3);
          y -= 8;
        } else if (c === 'queso') {
          g.fillStyle(0xf8d040, 1).fillRect(100, y - 3, 60, 3);
          for (let k = 0; k < 4; k++) g.fillTriangle(104 + k * 15, y, 112 + k * 15, y, 108 + k * 15, y + 5);
          y -= 3;
        } else {
          for (let k = 0; k < 3; k++) {
            g.fillStyle(0xd83c30, 1).fillEllipse(110 + k * 20, y - 2, 18, 5);
            g.fillStyle(0xf88070, 1).fillEllipse(110 + k * 20, y - 2, 10, 2);
          }
          y -= 4;
        }
      });
      // La receta (de abajo hacia arriba), con la tecla de cada capa.
      g.fillStyle(0xf8f4e6, 1).fillRoundedRect(214, 86, 96, 86, 4);
      g.lineStyle(1, 0x2a2433, 1).strokeRoundedRect(214, 86, 96, 86, 4);
      RECETA.forEach((c, i) => {
        const yy = 160 - i * 12;
        const done = i < this.stack.length;
        const now = i === this.stack.length;
        g.fillStyle(done ? 0x58c858 : now ? 0xf8e070 : 0xe8e0d0, 1).fillRoundedRect(220, yy - 5, 84, 10, 3);
        g.fillStyle(CAPA_COLOR[c], 1).fillRect(224, yy - 3, 10, 6);
        this.hudLabel(`${c} · ${KEY_LABEL[CAPA_KEY[c]]}`, 238, yy - 5);
      });
    }
  }
}
