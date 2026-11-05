import Phaser from 'phaser';
import { playMusic, playSfx, setAmbient } from '../audio/sfx';
import { frameIndex, type HumanLook } from '../art/characters';
import { ensureCharacterTexture } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import type { Direction } from '../types/map';
import { Controls } from '../systems/Controls';
import { parseClock } from '../systems/Mission';
import { currentOutfit, playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { skyColor } from '../systems/Weather';
import { drawPanel, makeText, THEME } from '../ui/theme';
import { Vineta } from '../ui/Vineta';
import { BaseScene } from './BaseScene';

/**
 * Partido de la misión 4: Intercambio FC (los de intercambio, con la polera azul de la PUCC)
 * contra Ingeniería FC, en la cancha del campus. Once contra once, vista cenital, cancha horizontal.
 *
 * Controlas solo a tu jugador (el 14): WASD para correr. Con la pelota, E apunta: el juego va en cámara
 * lenta, WASD gira la flecha y la barra de potencia sube y baja; E otra vez patea (suave = pase, fuerte
 * = tiro; si la flecha apunta a un compañero, el pase lo busca). F o Shift hacen una filigrana que deja
 * parado al rival. Sin la pelota, E le quita la pelota al rival que tengas cerca o se la pide a un
 * compañero. El resto juega solo, cada uno en su puesto.
 * Coordenadas en px de cancha (0,0 = esquina superior izquierda); se dibuja con un margen.
 */

export interface FutbolResult {
  us: number;
  them: number;
  /** Goles que hiciste tú. */
  myGoals: number;
  /** Autogoles tuyos (la pelota la tocaste tú y entró en nuestro arco). */
  ownGoals: number;
}

export interface FutbolSceneData {
  done: (result: FutbolResult) => void;
  /** Antes del pitazo, el calentamiento con el equipo (tutorial). */
  tutorial?: boolean;
}

const FW = 560;
const FH = 340;
const MARGIN = 44;
const GOAL_HALF = 28;
const GOAL_DEPTH = 12;
const CROSSBAR_Z = 12;
const BOX_DEPTH = 76;
const BOX_HALF = 82;
/** Duración real de cada tiempo (el reloj del partido muestra 45 minutos). */
const HALF_MS = 80_000;
/** Hora del partido: empieza 16:30 y termina 18:15 (el reloj de la historia avanza con él). */
const KICKOFF_CLOCK = 'lun 16:30';
const END_CLOCK = 'lun 18:15';

const HUMAN_SPEED = 74;
/** Con la pelota en los pies se corre más lento (los defensas alcanzan al que se manda solo). */
const DRIBBLE_SLOW = 0.78;
const AI_SPEED = { GK: 62, DEF: 64, MID: 68, FWD: 70 } as const;
const PICKUP_DIST = 7;
const TACKLE_DIST = 13;
const BALL_FRICTION = 1.35;
const PASS_MIN = 120;
const PASS_MAX = 270;
const SHOT_MIN = 190;
const SHOT_MAX = 340;
/** Apuntar: el juego va a esta velocidad mientras eliges dirección y potencia. */
const AIM_SLOWMO = 0.04;
/** La barra de potencia sube y baja en este tiempo (real). */
const AIM_PERIOD_MS = 1800;
/** Si no pateas en este tiempo (real), patea solo. */
const AIM_TIMEOUT_MS = 4500;
const AIM_TURN = 2.4;
const KICK_MIN = 100;
const KICK_MAX = 360;
/** Ángulo (rad) dentro del que la flecha "encuentra" a un compañero. */
const AIM_CONE = 0.24;
/** Velocidad con que el pase le llega al compañero (la pelota frena parejo: v = v0 - fricción · distancia). */
const RECEIVE_SPEED = 70;
const TRICK_COOLDOWN = 1.6;
/** Tras la filigrana no te pueden quitar la pelota por un momento, y los rivales cerca quedan parados. */
const TRICK_IMMUNE = 0.7;
const TRICK_FREEZE = 0.7;
const TRICK_REACH = 28;
/** Quites por segundo que intenta la IA cuando alcanza al que lleva la pelota. */
const STEAL_RATE = 1.1;
const STEAL_DIST = 10;
/** Espera entre dos quites tuyos (no se puede robar apretando E sin parar). */
const TACKLE_COOLDOWN = 0.7;
/** Distancia al arco desde la que la IA se anima a tirar. */
const SHOT_RANGE = 190;

const HINT = 'Con la pelota: E apunta (WASD gira la flecha) y E otra vez patea · F: filigrana\nSin la pelota: E le quita la pelota al rival o se la pide a un compañero';
const HINT_AIM = 'Cámara lenta: WASD gira la flecha · E patea cuando la barra esté donde quieres';

const BLUE = '#2050a8';
const GREEN = '#2c9c4c';

type Role = keyof typeof AI_SPEED;
type Team = 0 | 1;

interface Player {
  name: string;
  team: Team;
  role: Role;
  /** Puesto en la formación: fracción de la cancha (atacando hacia la derecha). */
  home: { x: number; y: number };
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  human: boolean;
  facing: Direction;
  sprite: Phaser.GameObjects.Sprite;
  texture: string;
  stepMs: number;
  step: 0 | 1 | 2;
  /** Sin poder tocar la pelota (recién la soltó o perdió un quite). */
  cooldown: number;
  stun: number;
  /** Próxima decisión con la pelota (IA). */
  think: number;
  /** El compañero pidió la pelota: pasarla apenas se pueda. */
  wantsPass: boolean;
  /** Tras una filigrana: no se le puede quitar la pelota. */
  immune: number;
}

interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  owner: Player | null;
  last: Player | null;
  /** A quién va dirigido el pase (lo recibe aunque venga rápido, y si eres tú la pelota te busca un poco). */
  target: Player | null;
}

/** Filigranas: nombre que salta y cómo se mueve tu jugador (amague de lado, caño por debajo, sombrero por arriba). */
type Trick = 'bicicleta' | 'caño' | 'sombrero' | 'elástica';
const TRICK_NAMES: Record<Trick, string> = { bicicleta: '¡Bicicleta!', caño: '¡Caño!', sombrero: '¡Sombrero!', elástica: '¡Elástica!' };

/** 4-4-2: [rol, x, y] atacando hacia la derecha. */
const FORMATION: Array<[Role, number, number]> = [
  ['GK', 0.03, 0.5],
  ['DEF', 0.2, 0.15],
  ['DEF', 0.18, 0.38],
  ['DEF', 0.18, 0.62],
  ['DEF', 0.2, 0.85],
  ['MID', 0.42, 0.15],
  ['MID', 0.38, 0.4],
  ['MID', 0.38, 0.6],
  ['MID', 0.42, 0.85],
  ['FWD', 0.6, 0.38],
  ['FWD', 0.6, 0.62],
];

const US: Array<{ name: string; skin: string; hair: string; style: HumanLook['hairStyle'] }> = [
  { name: 'Mathieu', skin: '#f0d0b0', hair: '#c8a060', style: 'short' },
  { name: 'Iker', skin: '#f0c8a0', hair: '#2a1c18', style: 'short' },
  { name: 'Hugo', skin: '#8a5a3c', hair: '#1c1418', style: 'short' },
  { name: 'Sergio', skin: '#e8b890', hair: '#3a2818', style: 'bald' },
  { name: 'Lucas', skin: '#f4d4b8', hair: '#a85830', style: 'long' },
  { name: 'Pau', skin: '#f0c8a0', hair: '#5a3828', style: 'bun' },
  { name: 'Diego', skin: '#c08860', hair: '#1c1418', style: 'short' },
  { name: 'Antoine', skin: '#f4d4b8', hair: '#5a3828', style: 'long' },
  { name: 'Nacho', skin: '#e8b894', hair: '#2a2020', style: 'cap' },
  { name: 'Álvaro', skin: '#e8c0a0', hair: '#3a2818', style: 'short' },
];
const THEM = ['Wilmar', 'Brayan', 'Kevin', 'Stiven', 'Jhon Fredy', 'Andrés', 'Camilo', 'Sebas', 'Juan Pablo', 'Cristian', 'Johan'];
const THEM_SKINS = ['#a87048', '#c89068', '#8a5a3c', '#d8a880', '#6a4430', '#b87850'];

function len(x: number, y: number): number {
  return Math.hypot(x, y);
}

function dirOf(vx: number, vy: number, fallback: Direction): Direction {
  if (Math.abs(vx) < 1 && Math.abs(vy) < 1) return fallback;
  if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

const DIR_UNIT: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export class FutbolScene extends BaseScene {
  private done!: (r: FutbolResult) => void;
  private players: Player[] = [];
  private human!: Player;
  private ball!: Ball;
  private ballSprite!: Phaser.GameObjects.Graphics;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private hudObjects: Phaser.GameObjects.GameObject[] = [];
  private worldObjects: Phaser.GameObjects.GameObject[] = [];
  private score: [number, number] = [0, 0];
  private myGoals = 0;
  private half: 1 | 2 = 1;
  private halfMs = 0;
  /** Pausa del juego (pitazo, gol, lateral) en ms; con `afterPause` se sigue. */
  private pauseMs = 0;
  private afterPause: (() => void) | null = null;
  private finished = false;
  /** Apuntando: ángulo de la flecha (rad) y cuándo empezó (ms reales). */
  private aiming: { angle: number; since: number } | null = null;
  private trickWait = 0;
  /** Ya pateaste una vez: la ayuda de abajo se oculta. */
  private kicked = false;
  private ownGoals = 0;
  private tutorial = false;
  /** Calentamiento en curso: el ejercicio actual (y una espera corta entre uno y otro). */
  private tut: { i: number; wait: number; retry: number; trickDone: boolean } | null = null;
  private tutText!: Phaser.GameObjects.Text;
  private tutBg!: Phaser.GameObjects.Graphics;
  private cone!: Phaser.GameObjects.Graphics;
  /** Viñetas del gol, el hat-trick y el autogol (la escena UI duerme durante el partido). */
  private vineta!: Vineta;
  private tackleWait = 0;
  private aim = { x: 1, y: 0 };
  private scoreText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private power!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Text;
  private radar!: Phaser.GameObjects.Graphics;
  private hint!: Phaser.GameObjects.Text;
  private sky!: Phaser.GameObjects.Rectangle;
  private clockFrom = 0;
  private clockTo = 0;

  constructor() {
    super('Futbol');
  }

  init(data: FutbolSceneData): void {
    this.done = data.done;
    this.tutorial = data.tutorial === true;
    this.tut = null;
    this.ownGoals = 0;
    this.players = [];
    this.hudObjects = [];
    this.worldObjects = [];
    this.score = [0, 0];
    this.myGoals = 0;
    this.half = 1;
    this.halfMs = 0;
    this.pauseMs = 0;
    this.afterPause = null;
    this.finished = false;
    this.aiming = null;
    this.kicked = false;
    this.trickWait = 0;
    this.tackleWait = 0;
    this.aim = { x: 1, y: 0 };
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#3c7c40');
    this.drawPitch();
    this.createPlayers();
    this.createBall();
    this.createHud();

    this.clockFrom = parseClock(KICKOFF_CLOCK);
    this.clockTo = parseClock(END_CLOCK);
    StoryState.setClock(this.clockFrom, this.clockFrom);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, FW + MARGIN * 2, FH + MARGIN * 2);
    this.hudCam = this.cameras.add(0, 0, cam.width, cam.height).setOrigin(0, 0);
    cam.ignore(this.hudObjects);
    this.hudCam.ignore(this.worldObjects);
    this.setupZoom();

    this.vineta = new Vineta(this, { standalone: true, onShow: (root) => this.cameras.main.ignore(root) });

    playMusic('futbol');
    setAmbient({ rain: 'none', indoor: false });
    if (this.tutorial) this.startTutorial();
    else this.kickoff(0, '¡Pitazo inicial!', 'Intercambio FC saca del medio');
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  protected override applyZoom(z: number): void {
    super.applyZoom(z);
    if (!this.hudCam) return;
    this.hudCam.setSize(BASE_WIDTH * z, BASE_HEIGHT * z).setZoom(z);
  }

  override update(_time: number, delta: number): void {
    // Apuntando, todo va en cámara lenta (menos la flecha y la barra de potencia).
    const slow = this.aiming && !this.finished && this.pauseMs <= 0 ? AIM_SLOWMO : 1;
    const dt = (Math.min(delta, 50) / 1000) * slow;
    if (this.finished) {
      if (Controls.consume('interact')) this.finish();
      this.render(dt);
      return;
    }
    if (this.pauseMs > 0) {
      // Con una viñeta en pantalla, E la salta.
      if (this.vineta.isOpen && Controls.consume('interact')) this.pauseMs = 1;
      this.pauseMs -= delta;
      if (this.pauseMs <= 0) {
        this.hideBanner();
        const next = this.afterPause;
        this.afterPause = null;
        next?.();
      }
      Controls.consume('interact');
      this.render(dt);
      return;
    }

    if (this.tut) {
      this.updateTutorial(dt, delta);
      this.render(dt);
      return;
    }

    this.halfMs += delta * slow;
    const elapsed = (this.half - 1) * HALF_MS + this.halfMs;
    StoryState.setClock(this.clockFrom + ((this.clockTo - this.clockFrom) * elapsed) / (HALF_MS * 2), this.clockTo);
    if (this.halfMs >= HALF_MS) {
      this.endHalf();
      this.render(dt);
      return;
    }

    this.updateHuman(dt, delta / 1000);
    for (const p of this.players) if (!p.human) this.updateAI(p, dt);
    this.updateBall(dt);
    this.render(dt);
  }

  // -------------------------------------------------------------------------
  // Armado
  // -------------------------------------------------------------------------

  private drawPitch(): void {
    const g = this.add.graphics();
    this.worldObjects.push(g);
    const ox = MARGIN;
    const oy = MARGIN;
    // Pasto de afuera (con la pista de trote) y franjas de la cancha.
    g.fillStyle(0x3c7c40, 1).fillRect(0, 0, FW + MARGIN * 2, FH + MARGIN * 2);
    g.fillStyle(0xc87858, 1).fillRect(8, 8, FW + MARGIN * 2 - 16, 14).fillRect(8, FH + MARGIN * 2 - 22, FW + MARGIN * 2 - 16, 14);
    for (let x = 0; x < FW; x += 40) g.fillStyle(x % 80 === 0 ? 0x5aac4a : 0x66ba54, 1).fillRect(ox + x, oy, 40, FH);
    // Charcos del aguacero del mediodía.
    g.fillStyle(0x7c9cb8, 0.55).fillEllipse(ox + 140, oy + 250, 26, 8).fillEllipse(ox + 400, oy + 90, 18, 6).fillEllipse(ox + 300, oy + 300, 14, 5);
    // Líneas.
    g.lineStyle(2, 0xf0f0e8, 1);
    g.strokeRect(ox, oy, FW, FH);
    g.lineBetween(ox + FW / 2, oy, ox + FW / 2, oy + FH);
    g.strokeCircle(ox + FW / 2, oy + FH / 2, 40);
    for (const side of [0, 1]) {
      const x = side === 0 ? ox : ox + FW - BOX_DEPTH;
      g.strokeRect(x, oy + FH / 2 - BOX_HALF, BOX_DEPTH, BOX_HALF * 2);
      const sx = side === 0 ? ox : ox + FW - 26;
      g.strokeRect(sx, oy + FH / 2 - 44, 26, 88);
      g.fillStyle(0xf0f0e8, 1).fillCircle(side === 0 ? ox + 54 : ox + FW - 54, oy + FH / 2, 1.5);
    }
    g.fillStyle(0xf0f0e8, 1).fillCircle(ox + FW / 2, oy + FH / 2, 2);
    // Arcos: la red atrás de la línea y los palos.
    for (const side of [0, 1]) {
      const gx = side === 0 ? ox - GOAL_DEPTH : ox + FW;
      g.fillStyle(0xd8dce0, 0.6).fillRect(gx, oy + FH / 2 - GOAL_HALF, GOAL_DEPTH, GOAL_HALF * 2);
      g.lineStyle(1, 0xa8aeb6, 1);
      for (let y = -GOAL_HALF; y <= GOAL_HALF; y += 4) g.lineBetween(gx, oy + FH / 2 + y, gx + GOAL_DEPTH, oy + FH / 2 + y);
      g.fillStyle(0xffffff, 1).fillRect(side === 0 ? ox - 2 : ox + FW, oy + FH / 2 - GOAL_HALF - 2, 2, 4).fillRect(side === 0 ? ox - 2 : ox + FW, oy + FH / 2 + GOAL_HALF - 2, 2, 4);
    }
    // Hinchas en la pista: compañeros de la U mirando el partido.
    const fans = this.add.graphics();
    this.worldObjects.push(fans);
    const colors = [0x2050a8, 0xe85878, 0xf0c030, 0x2c9c4c, 0xf8f8f0, 0xe88838, 0x9c6cb8];
    for (let i = 0; i < 46; i++) {
      const x = 30 + ((i * 53) % (FW + MARGIN * 2 - 60));
      const y = i % 2 === 0 ? 10 : FH + MARGIN * 2 - 20;
      fans.fillStyle(colors[i % colors.length], 1).fillRect(x, y + 4, 5, 6);
      fans.fillStyle(0xc89070, 1).fillRect(x + 1, y, 3, 4);
    }
  }

  private makeTexture(key: string, look: HumanLook): string {
    ensureCharacterTexture(this.textures, key, look);
    return key;
  }

  private createPlayers(): void {
    const me = playerLook({ ...currentOutfit(), shirt: BLUE, pants: '#f0f0e8' }, false);
    const humanTex = this.makeTexture(`futbol:yo:${JSON.stringify(me)}`, { ...me, extras: (me.extras ?? []).filter((e) => e !== 'backpack') });
    FORMATION.forEach(([role, hx, hy], i) => {
      // Nuestro equipo: el 11 (delantero de abajo) eres tú.
      const human = i === 10;
      const mate = US[Math.min(i, US.length - 1)];
      const ourTex = human
        ? humanTex
        : this.makeTexture(`futbol:us:${i}`, {
            skin: mate.skin,
            hair: mate.hair,
            shirt: role === 'GK' ? '#e88838' : BLUE,
            pants: role === 'GK' ? '#2a2a34' : '#f0f0e8',
            hairStyle: mate.style,
            cap: '#c83838',
          });
      this.addPlayer(human ? 'Tú' : mate.name, 0, role, hx, hy, ourTex, human);
      const theirTex = this.makeTexture(`futbol:them:${i}`, {
        skin: THEM_SKINS[i % THEM_SKINS.length],
        hair: '#1c1418',
        shirt: role === 'GK' ? '#2a2a34' : GREEN,
        pants: role === 'GK' ? '#2a2a34' : '#f8f8f0',
        hairStyle: i % 3 === 0 ? 'cap' : 'short',
        cap: '#f8f8f0',
      });
      this.addPlayer(THEM[i], 1, role, hx, hy, theirTex, false);
    });
  }

  private addPlayer(name: string, team: Team, role: Role, hx: number, hy: number, texture: string, human: boolean): void {
    const sprite = this.add.sprite(0, 0, texture, frameIndex(team === 0 ? 'right' : 'left', 0)).setOrigin(0.5, 1);
    this.worldObjects.push(sprite);
    const p: Player = {
      name,
      team,
      role,
      home: { x: hx, y: hy },
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      speed: human ? HUMAN_SPEED : AI_SPEED[role] * (team === 1 ? 1.06 : 1),
      human,
      facing: team === 0 ? 'right' : 'left',
      sprite,
      texture,
      stepMs: 0,
      step: 0,
      cooldown: 0,
      stun: 0,
      think: 0,
      wantsPass: false,
      immune: 0,
    };
    this.players.push(p);
    if (human) this.human = p;
  }

  private createBall(): void {
    this.ballShadow = this.add.ellipse(0, 0, 6, 3, 0x000000, 0.3);
    this.ballSprite = this.add.graphics();
    this.ballSprite.fillStyle(0x2a2433, 1).fillCircle(0, 0, 3);
    this.ballSprite.fillStyle(0xf8f8f0, 1).fillCircle(0, 0, 2.2);
    this.ballSprite.fillStyle(0x2a2433, 1).fillRect(-1, -1, 1, 1).fillRect(1, 0, 1, 1);
    this.worldObjects.push(this.ballShadow, this.ballSprite);
    this.ball = { x: FW / 2, y: FH / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, target: null };
  }

  private createHud(): void {
    // El cielo de la tarde: el mismo velo de los mapas, según la hora del partido.
    this.sky = this.add.rectangle(0, 0, FW + MARGIN * 2, FH + MARGIN * 2, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(9000);
    this.worldObjects.push(this.sky);
    this.marker = makeText(this, 0, 0, 'TÚ', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f8e070', stroke: '#1a2236', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(9500);
    this.power = this.add.graphics().setDepth(9500);
    this.worldObjects.push(this.marker, this.power);

    const bg = this.add.graphics();
    drawPanel(bg, BASE_WIDTH / 2 - 78, 3, 156, 16, { radius: 5, fill: THEME.dark, edge: 0x5a6a90, alpha: 0.92, shadow: false });
    bg.fillStyle(0x2050a8, 1).fillRect(BASE_WIDTH / 2 - 72, 8, 6, 6);
    bg.fillStyle(0x2c9c4c, 1).fillRect(BASE_WIDTH / 2 + 66, 8, 6, 6);
    this.scoreText = makeText(this, BASE_WIDTH / 2, 11, '', { fontFamily: FONT_HUD, fontSize: '8px' }).setOrigin(0.5);
    this.radar = this.add.graphics();
    this.bannerBg = this.add.graphics();
    this.bannerText = makeText(this, BASE_WIDTH / 2, 66, '', { fontFamily: FONT_HUD, fontSize: '10px', align: 'center', color: '#f8e070' }).setOrigin(0.5);
    this.hint = makeText(this, BASE_WIDTH / 2, BASE_HEIGHT - 8, HINT, {
      align: 'center',
      fontSize: '8px',
      color: '#ffffff',
      backgroundColor: '#1a2236cc',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1);
    this.tutBg = this.add.graphics();
    this.tutText = makeText(this, BASE_WIDTH / 2, 28, '', { fontSize: '9px', align: 'center', color: '#ffffff', wordWrap: { width: 280 } }).setOrigin(0.5, 0);
    this.cone = this.add.graphics().setVisible(false);
    this.worldObjects.push(this.cone);
    this.hudObjects.push(bg, this.scoreText, this.radar, this.bannerBg, this.bannerText, this.hint, this.tutBg, this.tutText);
  }

  // -------------------------------------------------------------------------
  // Reglas: saques, goles, tiempos
  // -------------------------------------------------------------------------

  /** Todos a su mitad y el equipo `team` saca del medio. */
  private kickoff(team: Team, title: string, subtitle: string): void {
    for (const p of this.players) {
      const home = this.homeOf(p, false);
      p.x = home.x;
      p.y = home.y;
      // Nadie pisa la mitad rival antes del saque.
      p.x = p.team === 0 ? Math.min(p.x, FW / 2 - 12) : Math.max(p.x, FW / 2 + 12);
      p.vx = p.vy = 0;
      p.cooldown = p.stun = p.immune = 0;
      p.wantsPass = false;
      p.facing = p.team === 0 ? 'right' : 'left';
    }
    const taker = this.players.filter((p) => p.team === team && p.role === 'FWD').sort((a, b) => (a.human ? -1 : b.human ? 1 : 0))[0];
    taker.x = FW / 2 + (team === 0 ? -6 : 6);
    taker.y = FH / 2;
    this.ball = { x: FW / 2, y: FH / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: taker, last: taker, target: null };
    taker.think = 0.6;
    playSfx('silbato');
    this.showBanner(title, subtitle);
    this.pauseMs = 1500;
  }

  private endHalf(): void {
    playSfx('silbato');
    if (this.half === 1) {
      this.half = 2;
      this.halfMs = 0;
      this.showBanner('Medio tiempo', `Intercambio ${this.score[0]} – ${this.score[1]} Ingeniería · ¡Agua y a seguir!`);
      this.pauseMs = 2600;
      this.afterPause = () => this.kickoff(1, 'Segundo tiempo', 'Ingeniería FC saca del medio');
      return;
    }
    this.finished = true;
    this.time.delayedCall(350, () => playSfx('silbato'));
    const [us, them] = this.score;
    const verdict = us > them ? '¡GANAMOS!' : us < them ? 'Perdimos...' : 'Empate';
    this.showBanner(`FINAL · ${verdict}`, `Intercambio ${us} – ${them} Ingeniería\n\n(E para seguir)`);
  }

  private finish(): void {
    this.finished = false;
    StoryState.setClock(this.clockTo, this.clockTo);
    const result: FutbolResult = { us: this.score[0], them: this.score[1], myGoals: this.myGoals, ownGoals: this.ownGoals };
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.done(result));
  }

  private goal(team: Team): void {
    const scorer = this.ball.last;
    if (this.tut) {
      this.tutorialGoal(team === 0 && scorer?.human === true);
      return;
    }
    this.score[team]++;
    const mine = team === 0 && scorer?.human === true;
    // Autogol: el último en tocarla fue del equipo que recibió el gol.
    const own = scorer !== null && scorer.team !== team;
    if (mine) this.myGoals++;
    if (own && scorer.human) this.ownGoals++;
    playSfx(own && team === 1 ? 'error' : 'gol');
    this.cameras.main.shake(300, 0.004);
    let who: string;
    if (own) who = `Autogol de ${scorer.human ? 'ti...' : scorer.name}`;
    else if (team === 0) who = mine ? '¡GOLAZO TUYO!' : `¡Gol de ${scorer?.name ?? 'Intercambio'}!`;
    else who = `Gol de ${scorer?.name ?? 'Ingeniería'}...`;
    const title = team === 0 ? '¡GOOOOL!' : own ? 'Autogol' : 'Gol de Ingeniería';
    const subtitle = `${who}\nIntercambio ${this.score[0]} – ${this.score[1]} Ingeniería`;
    this.ball.owner = null;
    this.aiming = null;
    const next = (): void => this.kickoff(team === 0 ? 1 : 0, 'Saque del medio', team === 0 ? 'Ingeniería FC' : 'Intercambio FC');
    const vin = mine ? (this.myGoals === 3 ? 'futbol_hattrick' : 'futbol_gol') : own && scorer.human ? 'futbol_autogol' : null;
    if (!vin) {
      this.showBanner(title, subtitle);
      this.pauseMs = 2200;
      this.afterPause = next;
      return;
    }
    // Tu gol, tu hat-trick o tu autogol: primero la viñeta (E la salta) y después el marcador.
    this.vineta.show(vin);
    this.pauseMs = 3600;
    this.afterPause = () => {
      this.vineta.hide();
      this.showBanner(title, subtitle);
      this.pauseMs = 1400;
      this.afterPause = next;
    };
  }

  /** La pelota salió por un costado: saque lateral para el otro equipo. */
  private throwIn(): void {
    if (this.tut) return this.tutorialRetry();
    const team: Team = this.ball.last?.team === 0 ? 1 : 0;
    const y = this.ball.y < 0 ? 2 : FH - 2;
    const x = Phaser.Math.Clamp(this.ball.x, 10, FW - 10);
    const taker = this.closest(x, y, (p) => p.team === team && p.role !== 'GK');
    taker.x = x;
    taker.y = y;
    this.ball = { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: taker, last: taker, target: null };
    taker.think = 0.5;
    this.showBanner('Lateral', team === 0 ? 'Para Intercambio' : 'Para Ingeniería');
    this.pauseMs = 900;
  }

  /** Salió por la línea de fondo (o pasó por encima del arco): saque del arquero. */
  private goalKick(side: 0 | 1): void {
    if (this.tut) return this.tutorialRetry();
    const team: Team = side === 0 ? 0 : 1;
    const gk = this.players.find((p) => p.team === team && p.role === 'GK')!;
    gk.x = side === 0 ? 18 : FW - 18;
    gk.y = FH / 2;
    this.ball = { x: gk.x, y: gk.y, z: 0, vx: 0, vy: 0, vz: 0, owner: gk, last: gk, target: null };
    gk.think = 0.9;
    this.showBanner('Saque de arco', team === 0 ? 'Mathieu' : 'Wilmar');
    this.pauseMs = 900;
  }

  // -------------------------------------------------------------------------
  // Calentamiento (tutorial antes del partido)
  // -------------------------------------------------------------------------

  private readonly TUT_STEPS = [
    'Primero, a moverse: corre con WASD hasta el cono amarillo.',
    'Pase: E para apuntar (todo se pone lento), gira la flecha con WASD hacia Álvaro (se marca con un anillo) y E otra vez con la barra baja.',
    'Pídela: ahora Álvaro tiene la pelota. Apreta E sin la pelota y te la pasa.',
    'Filigrana: Johan te marca. Con la pelota, apreta F (o Shift) y lo dejas parado.',
    'Remate: al arco. E para apuntar al arco y E con la barra en rojo: ¡cañonazo!',
  ];

  private startTutorial(): void {
    this.tut = { i: 0, wait: 0, retry: 0, trickDone: false };
    playSfx('silbato');
    this.setupTutorialStep();
  }

  /** Acomoda la cancha para el ejercicio actual. Los que no participan no tocan la pelota. */
  private setupTutorialStep(): void {
    const t = this.tut!;
    for (const p of this.players) {
      const home = this.homeOf(p, false);
      p.x = p.team === 0 ? Math.min(home.x, FW / 2 - 12) : Math.max(home.x, FW / 2 + 12);
      p.y = home.y;
      p.vx = p.vy = 0;
      p.stun = 0;
      p.immune = 0;
      p.wantsPass = false;
      p.cooldown = 999;
    }
    const h = this.human;
    const alvaro = this.players.find((p) => p.name === 'Álvaro')!;
    const johan = this.players.find((p) => p.name === 'Johan')!;
    const gk = this.players.find((p) => p.team === 1 && p.role === 'GK')!;
    h.cooldown = 0;
    this.aiming = null;
    t.trickDone = false;
    this.ball = { x: FW / 2, y: FH / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, target: null };
    this.cone.setVisible(t.i === 0);
    if (t.i === 0) {
      h.x = FW / 2 - 60;
      h.y = FH / 2 + 30;
      this.cone.clear().fillStyle(0xf0c030, 1).fillTriangle(0, -10, -5, 2, 5, 2).fillStyle(0xf8f8f0, 1).fillRect(-3, -5, 6, 2);
      this.cone.setPosition(FW / 2 + 60 + MARGIN, FH / 2 - 50 + MARGIN);
      // La pelota espera al lado del cono (y la cámara la sigue: así se ve adónde ir).
      this.ball.x = FW / 2 + 72;
      this.ball.y = FH / 2 - 48;
    } else if (t.i === 1) {
      h.x = 220;
      h.y = 180;
      alvaro.x = 320;
      alvaro.y = 140;
      alvaro.cooldown = 0;
      this.ball.owner = h;
    } else if (t.i === 2) {
      h.x = 230;
      h.y = 200;
      alvaro.x = 330;
      alvaro.y = 150;
      alvaro.cooldown = 0;
      this.ball.owner = alvaro;
    } else if (t.i === 3) {
      h.x = 250;
      h.y = 170;
      this.aim = { x: 1, y: 0 };
      johan.x = 266;
      johan.y = 170;
      johan.facing = 'left';
      this.ball.owner = h;
    } else {
      h.x = FW - 150;
      h.y = FH / 2 + 20;
      gk.cooldown = 0;
      this.ball.owner = h;
    }
    this.ball.last = this.ball.owner;
    this.showTutorialText();
  }

  private showTutorialText(): void {
    const t = this.tut!;
    const retry = t.retry > 0 ? '  (¡otra vez!)' : '';
    this.tutText.setText(`Calentamiento ${t.i + 1}/${this.TUT_STEPS.length}${retry}\n${this.TUT_STEPS[t.i]}\nEsc: saltar el calentamiento`);
    const w = 292;
    this.tutBg.clear();
    drawPanel(this.tutBg, BASE_WIDTH / 2 - w / 2, 24, w, this.tutText.height + 8, { radius: 5, fill: THEME.dark, edge: 0x5a6a90, alpha: 0.92, shadow: false });
  }

  private updateTutorial(dt: number, delta: number): void {
    const t = this.tut!;
    if (Controls.consume('menu')) return this.endTutorial();
    if (t.wait > 0) {
      t.wait -= delta;
      if (t.wait <= 0) {
        if (t.i >= this.TUT_STEPS.length) return this.endTutorial();
        this.setupTutorialStep();
      }
      return;
    }
    const h = this.human;
    const alvaro = this.players.find((p) => p.name === 'Álvaro')!;
    const gk = this.players.find((p) => p.team === 1 && p.role === 'GK')!;
    this.updateHuman(dt, delta / 1000);
    if (t.i === 2 && alvaro.wantsPass && this.ball.owner === alvaro) {
      alvaro.wantsPass = false;
      this.pass(alvaro, h);
    }
    if (t.i === 4) this.updateAI(gk, dt);
    this.updateBall(dt);
    const b = this.ball;
    const done =
      (t.i === 0 && len(h.x - (FW / 2 + 60), h.y - (FH / 2 - 50)) < 12) ||
      (t.i === 1 && b.owner === alvaro) ||
      (t.i === 2 && b.owner === h) ||
      (t.i === 3 && t.trickDone);
    if (done) return this.tutorialSuccess();
    // Pase o remate que no llegó (la pelota quedó quieta, o la atajó el arquero): se repite.
    const stuck = (t.i === 1 || t.i === 4) && !b.owner && len(b.vx, b.vy) < 5 && b.last === h;
    if (stuck || (t.i === 4 && b.owner === gk)) this.tutorialRetry();
  }

  private tutorialSuccess(): void {
    const t = this.tut!;
    playSfx('select');
    this.popText(this.human, t.i === this.TUT_STEPS.length - 1 ? '¡Golazo!' : '¡Bien!', true);
    t.i++;
    t.retry = 0;
    t.wait = t.i >= this.TUT_STEPS.length ? 1200 : 900;
  }

  private tutorialRetry(): void {
    const t = this.tut!;
    if (t.wait > 0) return;
    t.retry++;
    t.wait = 800;
    this.popText(this.human, '¡Casi!', true);
  }

  private tutorialGoal(mine: boolean): void {
    if (mine && this.tut!.i === 4) this.tutorialSuccess();
    else this.tutorialRetry();
  }

  /** Fin del calentamiento (o lo saltaste con Esc): todos a sus puestos y pitazo inicial. */
  private endTutorial(): void {
    this.tut = null;
    this.aiming = null;
    this.cone.setVisible(false);
    this.tutText.setText('');
    this.tutBg.clear();
    this.kickoff(0, '¡Pitazo inicial!', 'Intercambio FC saca del medio');
  }

  // -------------------------------------------------------------------------
  // Tu jugador
  // -------------------------------------------------------------------------

  /** `realDt`: segundos reales (la flecha y la barra no van en cámara lenta). */
  private updateHuman(dt: number, realDt: number): void {
    const p = this.human;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.immune = Math.max(0, p.immune - dt);
    this.tackleWait = Math.max(0, this.tackleWait - dt);
    this.trickWait = Math.max(0, this.trickWait - dt);
    let ix = 0;
    let iy = 0;
    if (Controls.isHeld('left')) ix -= 1;
    if (Controls.isHeld('right')) ix += 1;
    if (Controls.isHeld('up')) iy -= 1;
    if (Controls.isHeld('down')) iy += 1;
    const n = len(ix, iy);
    const owner = this.ball.owner === p;
    if (this.aiming && !owner) this.aiming = null;

    if (this.aiming) {
      // WASD gira la flecha hacia donde apuntas; tu jugador se queda quieto con la pelota.
      if (n > 0) {
        const want = Math.atan2(iy, ix);
        const diff = Phaser.Math.Angle.Wrap(want - this.aiming.angle);
        this.aiming.angle += Phaser.Math.Clamp(diff, -AIM_TURN * realDt, AIM_TURN * realDt);
      }
      p.vx = p.vy = 0;
      this.aim = { x: Math.cos(this.aiming.angle), y: Math.sin(this.aiming.angle) };
      this.move(p, dt);
      if (Controls.consume('interact') || this.time.now - this.aiming.since > AIM_TIMEOUT_MS) this.releaseKick();
      Controls.consume('trick');
      return;
    }

    if (n > 0) this.aim = { x: ix / n, y: iy / n };
    const boost = p.immune > TRICK_IMMUNE - 0.3 ? 1.6 : 1;
    const speed = p.stun > 0 ? p.speed * 0.3 : owner ? p.speed * DRIBBLE_SLOW * boost : p.speed;
    p.vx = n > 0 ? (ix / n) * speed : 0;
    p.vy = n > 0 ? (iy / n) * speed : 0;
    this.move(p, dt);

    if (Controls.consume('trick') && owner) this.trick();
    if (Controls.consume('interact')) {
      if (owner) this.aiming = { angle: this.initialAim(), since: this.time.now };
      else this.humanAction();
    }
  }

  /** Hacia dónde parte la flecha: el arco si estás cerca, si no hacia donde corrías. */
  private initialAim(): number {
    const p = this.human;
    if (FW - p.x < 170) return Math.atan2(FH / 2 - p.y, FW - p.x);
    return Math.atan2(this.aim.y, this.aim.x);
  }

  /** Potencia de la barra (0 a 1): sube y baja sola mientras apuntas. */
  private aimPower(): number {
    if (!this.aiming) return 0;
    const t = (this.time.now - this.aiming.since) / AIM_PERIOD_MS;
    return 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
  }

  /** El compañero al que apunta la flecha (si hay uno cerca de la línea). */
  private aimedMate(): Player | null {
    if (!this.aiming) return null;
    const p = this.human;
    let best: Player | null = null;
    let bestDiff = AIM_CONE;
    for (const m of this.players) {
      if (m.team !== 0 || m === p) continue;
      const d = len(m.x - p.x, m.y - p.y);
      if (d < 14 || d > 300) continue;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(m.y - p.y, m.x - p.x) - this.aiming.angle));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = m;
      }
    }
    return best;
  }

  /** Patea con la dirección de la flecha y la potencia de la barra. */
  private releaseKick(): void {
    const p = this.human;
    const power = this.aimPower();
    const mate = this.aimedMate();
    const angle = this.aiming!.angle;
    this.aiming = null;
    this.kicked = true;
    const speed = KICK_MIN + (KICK_MAX - KICK_MIN) * power;
    const lift = power > 0.72 ? 20 + power * 30 : 0;
    this.kick(p, Math.cos(angle), Math.sin(angle), speed, lift, mate);
    if (power > 0.9) this.popText(p, '¡Cañonazo!');
  }

  /** Filigrana: amague, caño, sombrero o elástica. Los rivales cerca se quedan parados y no te la pueden quitar. */
  private trick(): void {
    const p = this.human;
    if (this.trickWait > 0 || p.stun > 0) return;
    this.trickWait = TRICK_COOLDOWN;
    p.immune = TRICK_IMMUNE;
    const near = this.players.filter((o) => o.team === 1 && len(o.x - p.x, o.y - p.y) < TRICK_REACH);
    const ahead = near.find((o) => (o.x - p.x) * this.aim.x + (o.y - p.y) * this.aim.y > 0);
    const kind: Trick = ahead ? (Math.random() < 0.5 ? 'caño' : 'sombrero') : Math.random() < 0.5 ? 'bicicleta' : 'elástica';
    for (const o of near) {
      o.stun = TRICK_FREEZE;
      o.cooldown = TRICK_FREEZE;
    }
    // Un pasito al costado (o por encima del rival con la pelota en el aire).
    const side = Math.random() < 0.5 ? 1 : -1;
    const sx = -this.aim.y * side;
    const sy = this.aim.x * side;
    const hop = kind === 'caño' ? 0 : kind === 'sombrero' ? 0 : 7;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 260,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        p.x = Phaser.Math.Clamp(p.x + sx * hop * 0.12 * Math.sin(k * Math.PI), 2, FW - 2);
        p.y = Phaser.Math.Clamp(p.y + sy * hop * 0.12 * Math.sin(k * Math.PI), 2, FH - 2);
        if (kind === 'sombrero') this.ball.z = Math.sin(k * Math.PI) * 10;
      },
    });
    if (kind === 'caño' && ahead) {
      // La pelota pasa entre las piernas del rival y la recoges del otro lado.
      p.x = Phaser.Math.Clamp(ahead.x + this.aim.x * 10 + sx * 6, 2, FW - 2);
      p.y = Phaser.Math.Clamp(ahead.y + this.aim.y * 10 + sy * 6, 2, FH - 2);
    }
    this.popText(p, TRICK_NAMES[kind], true);
    if (this.tut) this.tut.trickDone = true;
    playSfx('patada');
    this.time.delayedCall(120, () => playSfx('select'));
    for (const o of near) this.popText(o, '?!');
  }

  /** Sin la pelota: quitársela al rival que la lleva cerca, o pedírsela al compañero. */
  private humanAction(): void {
    const owner = this.ball.owner;
    if (owner && owner.team === 1 && len(owner.x - this.human.x, owner.y - this.human.y) < TACKLE_DIST) {
      if (this.tackleWait > 0 || this.human.stun > 0) return;
      this.tackleWait = TACKLE_COOLDOWN;
      if (Math.random() < 0.6) this.steal(this.human, owner);
      else {
        this.human.stun = 0.5;
        playSfx('bump');
      }
      return;
    }
    if (owner && owner.team === 0) {
      owner.wantsPass = true;
      this.popText(this.human, '¡Pásala!');
    }
  }

  // -------------------------------------------------------------------------
  // IA
  // -------------------------------------------------------------------------

  /** Puesto del jugador según dónde está la pelota y quién la tiene. */
  private homeOf(p: Player, live = true): { x: number; y: number } {
    const atk = p.team === 0 ? 1 : -1;
    const fx = p.team === 0 ? p.home.x : 1 - p.home.x;
    let x = fx * FW;
    let y = p.home.y * FH;
    if (!live) return { x: x * 0.92 + (p.team === 0 ? 0 : FW * 0.08), y };
    if (p.role === 'GK') {
      const gx = p.team === 0 ? 10 : FW - 10;
      const b = this.ball;
      // Si viene un tiro, se tira hacia donde va a pasar la pelota; si no, acompaña la pelota cubriendo el arco.
      const incoming = !b.owner && (p.team === 0 ? b.vx < -80 : b.vx > 80);
      const ty = incoming ? b.y + b.vy * ((gx - b.x) / b.vx) : FH / 2 + (b.y - FH / 2) * 0.75;
      return { x: gx, y: Phaser.Math.Clamp(ty, FH / 2 - GOAL_HALF + 3, FH / 2 + GOAL_HALF - 3) };
    }
    // El que ataca se abre hacia adelante; el que defiende mantiene su línea y solo se corre un poco hacia la pelota.
    const attacking = this.ball.owner?.team === p.team;
    const pull = attacking ? 0.4 : 0.25;
    x = x * (1 - pull) + this.ball.x * pull + (attacking ? 70 : -20) * atk;
    y = y * 0.75 + this.ball.y * 0.25;
    // Los defensas no se van al ataque; los delanteros no bajan a defender.
    if (p.role === 'DEF') x = p.team === 0 ? Math.min(x, FW * 0.62) : Math.max(x, FW * 0.38);
    // El arquero rival tiene la pelota: hay que salir del área (no se le puede quitar).
    const keeper = this.ball.owner;
    if (keeper?.role === 'GK' && keeper.team !== p.team) {
      x = keeper.team === 0 ? Math.max(x, BOX_DEPTH + 20) : Math.min(x, FW - BOX_DEPTH - 20);
    }
    // Cerca del arco propio, los defensas se paran entre la pelota y el arco (cierran el paso).
    const ownGoalX = p.team === 0 ? 0 : FW;
    if (!attacking && p.role === 'DEF' && Math.abs(this.ball.x - ownGoalX) < 200) {
      const gx = this.ball.x + (ownGoalX - this.ball.x) * 0.35;
      const gy = this.ball.y + (FH / 2 - this.ball.y) * 0.35 + (p.home.y - 0.5) * 70;
      x = (x + gx) / 2;
      y = (y + gy) / 2;
    }
    if (p.role === 'FWD') x = p.team === 0 ? Math.max(x, FW * 0.35) : Math.min(x, FW * 0.65);
    return { x: Phaser.Math.Clamp(x, 8, FW - 8), y: Phaser.Math.Clamp(y, 8, FH - 8) };
  }

  private updateAI(p: Player, dt: number): void {
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.stun = Math.max(0, p.stun - dt);
    const ball = this.ball;
    let target = this.homeOf(p);
    let speed = p.speed;

    if (ball.owner === p) {
      this.decide(p, dt);
      if (ball.owner === p && p.role === 'GK') target = { x: p.x, y: p.y };
      else if (ball.owner === p) {
        const atk = p.team === 0 ? 1 : -1;
        const goalX = p.team === 0 ? FW : 0;
        target = { x: p.x + atk * 40, y: p.y + (FH / 2 - p.y) * 0.25 + Math.sin(this.time.now / 500 + p.home.y * 9) * 18 };
        if (Math.abs(goalX - p.x) < 60) target.y = FH / 2;
        speed *= 0.95;
      }
    } else if (p.role === 'GK') {
      // Al tirarse a atajar es más rápido.
      if (!ball.owner && len(ball.vx, ball.vy) > 150) speed *= 1.5;
      // El arquero sale a buscar la pelota suelta si está en su área y llega primero.
      const inBox = p.team === 0 ? ball.x < BOX_DEPTH : ball.x > FW - BOX_DEPTH;
      if (!ball.owner && inBox && Math.abs(ball.y - FH / 2) < BOX_HALF && this.closest(ball.x, ball.y, () => true) === p) target = { x: ball.x, y: ball.y };
    } else if (ball.target === p && !ball.owner) {
      // Le pasaron la pelota: va a su encuentro.
      target = { x: ball.x + ball.vx * 0.25, y: ball.y + ball.vy * 0.25 };
    } else if (this.isChaser(p)) {
      target = { x: ball.x, y: ball.y };
    }
    // Quite: cualquiera que alcance al rival que lleva la pelota intenta robarla.
    const owner = ball.owner;
    if (owner && owner.team !== p.team && owner.immune <= 0 && owner.role !== 'GK' && p.role !== 'GK' && p.stun <= 0 && len(owner.x - p.x, owner.y - p.y) < STEAL_DIST && Math.random() < STEAL_RATE * dt) {
      this.steal(p, owner);
    }

    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = len(dx, dy);
    const s = p.stun > 0 ? speed * 0.3 : speed * Math.min(1, d / 18);
    p.vx = d > 2 ? (dx / d) * s : 0;
    p.vy = d > 2 ? (dy / d) * s : 0;
    // No amontonarse con los compañeros.
    for (const o of this.players) {
      if (o === p || o.team !== p.team) continue;
      const ox = p.x - o.x;
      const oy = p.y - o.y;
      const od = len(ox, oy);
      if (od > 0 && od < 14) {
        p.vx += (ox / od) * 30;
        p.vy += (oy / od) * 30;
      }
    }
    this.move(p, dt);
  }

  /**
   * Los que salen a la pelota: los dos más cercanos de cada equipo (sin arquero ni tú). En tu equipo,
   * si tú estás más cerca, sale uno solo.
   */
  private isChaser(p: Player): boolean {
    const ball = this.ball;
    if (ball.owner?.team === p.team) return false;
    // Al arquero con la pelota en las manos no se le va encima.
    if (ball.owner?.role === 'GK') return false;
    const d = (m: Player): number => len(m.x - ball.x, m.y - ball.y);
    const mates = this.players.filter((m) => m.team === p.team && m.role !== 'GK' && !m.human).sort((a, b) => d(a) - d(b));
    const humanCloser = p.team === 0 && len(this.human.x - ball.x, this.human.y - ball.y) < d(mates[0]);
    return mates.indexOf(p) < (humanCloser ? 1 : 2);
  }

  /** Con la pelota: tirar, pasar o seguir corriendo. */
  private decide(p: Player, dt: number): void {
    p.think -= dt;
    const goalX = p.team === 0 ? FW : 0;
    // Pidió la pelota el jugador: se la pasan apenas pueden.
    if (p.team === 0 && p.wantsPass && p.think < 0.25) {
      p.wantsPass = false;
      this.pass(p, this.human);
      return;
    }
    if (p.think > 0) return;
    p.think = 0.3 + Math.random() * 0.35;

    if (p.role === 'GK') {
      // Saque del arquero: a un compañero bien libre, o un pelotazo alto hacia adelante (pasa por encima de todos).
      const outlet = this.bestPass(p, 260);
      if (outlet && this.pressure(outlet) < 0.25 && len(outlet.x - p.x, outlet.y - p.y) > 60) this.pass(p, outlet);
      else this.kick(p, p.team === 0 ? 1 : -1, (Math.random() - 0.5) * 0.7, 300, 85);
      return;
    }
    const toGoal = Math.abs(goalX - p.x);
    if (toGoal < SHOT_RANGE && Math.abs(p.y - FH / 2) < 120 && Math.random() < (toGoal < 110 ? 0.8 : 0.35)) {
      const aimY = FH / 2 + (Math.random() - 0.5) * GOAL_HALF * 1.7;
      const err = (Math.random() - 0.5) * (p.team === 1 ? 0.28 : 0.24);
      const dx = goalX - p.x;
      const dy = aimY - p.y;
      const d = len(dx, dy);
      this.shoot(p, dx / d, dy / d + err, SHOT_MIN + Math.random() * (SHOT_MAX - SHOT_MIN) * 0.8);
      return;
    }
    const pressured = this.pressure(p) > 0.65;
    if (pressured || Math.random() < 0.15) {
      const mate = this.bestPass(p, 200);
      if (mate) this.pass(p, mate);
    }
  }

  /** Compañero libre y adelantado a quien pasarle (tu equipo te prefiere a ti si estás libre). */
  private bestPass(p: Player, maxDist: number): Player | null {
    const atk = p.team === 0 ? 1 : -1;
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const m of this.players) {
      if (m.team !== p.team || m === p || m.role === 'GK') continue;
      const d = len(m.x - p.x, m.y - p.y);
      if (d < 24 || d > maxDist) continue;
      const ahead = ((m.x - p.x) * atk) / 100;
      const score = ahead - this.pressure(m) * 1.4 - d / 300 + (m.human ? 0.45 : 0) + Math.random() * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  /** 0 = libre, 1 = un rival encima. */
  private pressure(p: Player): number {
    let worst = 0;
    for (const o of this.players) {
      if (o.team === p.team) continue;
      const d = len(o.x - p.x, o.y - p.y);
      worst = Math.max(worst, Phaser.Math.Clamp(1 - (d - 8) / 30, 0, 1));
    }
    return worst;
  }

  private closest(x: number, y: number, filter: (p: Player) => boolean): Player {
    let best = this.players[0];
    let bestD = Infinity;
    for (const p of this.players) {
      if (!filter(p)) continue;
      const d = len(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Pelota
  // -------------------------------------------------------------------------

  private pass(from: Player, to: Player): void {
    // Se pasa un poco adelante del compañero, a donde va corriendo (a ti, casi a los pies: no se sabe a dónde vas).
    const lead = to.human ? 0.12 : 0.25;
    const tx = to.x + to.vx * lead;
    const ty = to.y + to.vy * lead;
    const dx = tx - from.x;
    const dy = ty - from.y;
    const d = Math.max(1, len(dx, dy));
    // La pelota frena parejo (v = v0 - fricción · distancia): así llega a los pies con RECEIVE_SPEED.
    this.kick(from, dx / d, dy / d, Phaser.Math.Clamp(RECEIVE_SPEED + BALL_FRICTION * d, PASS_MIN, PASS_MAX), d > 170 ? 40 : 0, to);
  }

  private shoot(p: Player, dx: number, dy: number, power: number): void {
    const n = Math.max(0.01, len(dx, dy));
    this.kick(p, dx / n, dy / n, power, 20 + Math.random() * 30);
  }

  private kick(p: Player, dx: number, dy: number, power: number, lift: number, target: Player | null = null): void {
    const n = Math.max(0.01, len(dx, dy));
    const b = this.ball;
    b.owner = null;
    b.last = p;
    b.target = target;
    b.vx = (dx / n) * power;
    b.vy = (dy / n) * power;
    b.vz = lift;
    p.cooldown = 0.35;
    playSfx('patada');
  }

  private steal(thief: Player, victim: Player): void {
    // Al arquero con la pelota en las manos no se le puede quitar.
    if (victim.immune > 0 || victim.role === 'GK') return;
    this.ball.owner = thief;
    this.ball.last = thief;
    victim.stun = 0.45;
    victim.cooldown = 0.5;
    thief.think = 0.25;
    playSfx('patada');
  }

  private updateBall(dt: number): void {
    const b = this.ball;
    if (b.owner) {
      const o = b.owner;
      const u = o.human ? this.aim : DIR_UNIT[o.facing];
      b.x = o.x + u.x * 5;
      b.y = o.y + u.y * 3 + 1;
      b.z = 0;
      b.vx = o.vx;
      b.vy = o.vy;
      return;
    }
    // Pase para ti: la pelota corrige un poco su rumbo hacia tus pies.
    const t = b.target;
    if (t?.human && b.z < 6) {
      const d = len(t.x - b.x, t.y - b.y);
      const sp = len(b.vx, b.vy);
      if (d < 140 && sp > 20) {
        const want = Math.atan2(t.y - b.y, t.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const a = cur + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - cur), -2.4 * dt, 2.4 * dt);
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vz -= 260 * dt;
    b.z = Math.max(0, b.z + b.vz * dt);
    if (b.z === 0 && b.vz < 0) b.vz = Math.abs(b.vz) > 40 ? -b.vz * 0.35 : 0;
    const f = Math.max(0, 1 - BALL_FRICTION * dt * (b.z > 0 ? 0.3 : 1));
    b.vx *= f;
    b.vy *= f;
    if (len(b.vx, b.vy) < 5) b.vx = b.vy = 0;

    this.checkKeepers();
    if (this.checkLines()) return;

    // ¿Quién la agarra? El más cercano que la alcance.
    if (b.z > 5) return;
    const fast = len(b.vx, b.vy) > 170;
    let taker: Player | null = null;
    let best = PICKUP_DIST;
    for (const p of this.players) {
      if (p.cooldown > 0 || p.stun > 0 || p.role === 'GK') continue;
      const d = len(p.x - b.x, p.y - b.y);
      const mine = p === b.target;
      // El destinatario del pase la recibe siempre (y tú, con un poco más de alcance).
      const reach = mine ? (p.human ? PICKUP_DIST + 5 : PICKUP_DIST + 3) : PICKUP_DIST;
      if (d < Math.max(best, reach) && (mine || !fast || Math.random() < 0.5)) {
        best = d;
        taker = p;
      }
    }
    if (taker) {
      b.owner = taker;
      b.last = taker;
      b.target = null;
      taker.think = 0.15 + Math.random() * 0.2;
    }
  }

  /** Atajadas: el arquero ataja (o no) lo que pasa a su alcance. */
  private checkKeepers(): void {
    const b = this.ball;
    for (const gk of this.players) {
      if (gk.role !== 'GK' || gk.cooldown > 0) continue;
      if (len(gk.x - b.x, gk.y - b.y) > 12 || b.z > CROSSBAR_Z + 2) continue;
      const speed = len(b.vx, b.vy);
      const towardOwnGoal = gk.team === 0 ? b.vx < 0 : b.vx > 0;
      const chance = towardOwnGoal ? Phaser.Math.Clamp(0.98 - (speed - 140) / 450, 0.4, 0.92) : 1;
      if (Math.random() < chance) {
        b.owner = gk;
        b.last = gk;
        b.vx = b.vy = b.vz = 0;
        b.z = 0;
        // Espera a que los rivales salgan del área antes de sacar.
        gk.think = 1.3;
        if (towardOwnGoal && speed > 150) this.popText(gk, '¡Atajada!');
      } else {
        gk.cooldown = 0.6;
        b.vy += (Math.random() - 0.5) * 60;
      }
      return;
    }
  }

  /** Goles, palos y pelotas afuera. Devuelve true si se paró el juego. */
  private checkLines(): boolean {
    const b = this.ball;
    if (b.y < -2 || b.y > FH + 2) {
      this.throwIn();
      return true;
    }
    for (const side of [0, 1] as const) {
      const crossed = side === 0 ? b.x < 0 : b.x > FW;
      if (!crossed) continue;
      const dy = Math.abs(b.y - FH / 2);
      if (Math.abs(dy - GOAL_HALF) < 2.5 && b.z < CROSSBAR_Z) {
        // ¡Palo! Rebota hacia la cancha.
        playSfx('poste');
        b.x = side === 0 ? 1 : FW - 1;
        b.vx = -b.vx * 0.55;
        b.vy += (Math.random() - 0.5) * 80;
        return false;
      }
      if (dy < GOAL_HALF && b.z < CROSSBAR_Z) this.goal(side === 0 ? 1 : 0);
      else this.goalKick(side);
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Movimiento y dibujo
  // -------------------------------------------------------------------------

  private move(p: Player, dt: number): void {
    // Con la pelota no se sale de la cancha (hay que tirar para hacer el gol).
    const edge = this.ball.owner === p ? -2 : 6;
    p.x = Phaser.Math.Clamp(p.x + p.vx * dt, -edge, FW + edge);
    p.y = Phaser.Math.Clamp(p.y + p.vy * dt, -edge, FH + edge);
    const moving = len(p.vx, p.vy) > 8;
    if (p.human && this.ball.owner === p) p.facing = dirOf(this.aim.x, this.aim.y, p.facing);
    else p.facing = dirOf(p.vx, p.vy, p.facing);
    if (!moving && this.ball.owner !== p && !p.human) {
      const toBall = dirOf(this.ball.x - p.x, this.ball.y - p.y, p.facing);
      p.facing = toBall;
    }
    if (moving) {
      p.stepMs += dt * 1000;
      if (p.stepMs > 130) {
        p.stepMs = 0;
        p.step = p.step === 1 ? 2 : 1;
      }
    } else p.step = 0;
  }

  private render(dt: number): void {
    for (const p of this.players) {
      p.sprite.setPosition(Math.round(p.x + MARGIN), Math.round(p.y + MARGIN)).setFrame(frameIndex(p.facing, p.step)).setDepth(p.y + MARGIN);
    }
    const b = this.ball;
    this.ballShadow.setPosition(Math.round(b.x + MARGIN), Math.round(b.y + MARGIN)).setDepth(b.y + MARGIN - 0.5);
    this.ballSprite.setPosition(Math.round(b.x + MARGIN), Math.round(b.y + MARGIN - 2 - b.z)).setDepth(b.y + MARGIN + 0.5);

    // Cámara: entre la pelota y tú, más cerca de la pelota.
    const h = this.human;
    const cx = b.x * 0.7 + h.x * 0.3 + MARGIN;
    const cy = b.y * 0.7 + h.y * 0.3 + MARGIN;
    const cam = this.cameras.main;
    const view = cam.worldView;
    cam.centerOn(view.centerX + (cx - view.centerX) * Math.min(1, dt * 6), view.centerY + (cy - view.centerY) * Math.min(1, dt * 6));

    this.marker.setPosition(Math.round(h.x + MARGIN), Math.round(h.y + MARGIN - 17));
    this.drawAim();

    const minute = Math.min(45, Math.floor((this.halfMs / HALF_MS) * 45)) + (this.half - 1) * 45;
    this.scoreText.setText(this.tut ? 'CALENTAMIENTO' : `INT ${this.score[0]} – ${this.score[1]} ING   ${String(minute).padStart(2, '0')}'`);
    this.sky.setFillStyle(skyColor(StoryState.clock));
    this.drawRadar();
    // La ayuda: hasta que pateas por primera vez.
    if (this.kicked || this.tut) {
      this.hint.setVisible(false);
    } else if (this.aiming) {
      if (this.hint.text !== HINT_AIM) this.hint.setText(HINT_AIM);
      this.hint.setVisible(true);
    } else if (this.half === 1) {
      if (this.hint.text !== HINT) this.hint.setText(HINT);
      this.hint.setVisible(true);
    } else this.hint.setVisible(false);
  }

  /** La flecha (largo y color según la potencia), la barra y el compañero que la flecha encuentra. */
  private drawAim(): void {
    const g = this.power.clear();
    if (!this.aiming) return;
    const h = this.human;
    const power = this.aimPower();
    const a = this.aiming.angle;
    const ox = h.x + MARGIN;
    const oy = h.y + MARGIN - 3;
    const length = 16 + power * 46;
    const color = power < 0.45 ? 0x68d868 : power < 0.75 ? 0xf0c030 : 0xe85040;
    // Puntos de la trayectoria y la punta de la flecha.
    for (let d = 8; d < length; d += 5) g.fillStyle(color, 0.9).fillRect(Math.round(ox + Math.cos(a) * d) - 1, Math.round(oy + Math.sin(a) * d) - 1, 2, 2);
    const tx = ox + Math.cos(a) * length;
    const ty = oy + Math.sin(a) * length;
    g.fillStyle(color, 1).fillTriangle(
      tx + Math.cos(a) * 5,
      ty + Math.sin(a) * 5,
      tx + Math.cos(a + 2.4) * 5,
      ty + Math.sin(a + 2.4) * 5,
      tx + Math.cos(a - 2.4) * 5,
      ty + Math.sin(a - 2.4) * 5,
    );
    // La barra de potencia bajo tus pies.
    const bx = Math.round(ox - 10);
    const by = Math.round(h.y + MARGIN + 4);
    g.fillStyle(0x1a2236, 1).fillRect(bx - 1, by - 1, 22, 5);
    g.fillStyle(color, 1).fillRect(bx, by, Math.round(20 * power), 3);
    g.fillStyle(0xffffff, 0.8).fillRect(bx + 14, by, 1, 3);
    // El compañero al que va el pase.
    const mate = this.aimedMate();
    if (mate) g.lineStyle(1, 0xf8e070, 1).strokeEllipse(mate.x + MARGIN, mate.y + MARGIN, 14, 6);
  }

  private drawRadar(): void {
    const w = 64;
    const h = Math.round((w * FH) / FW);
    const x0 = BASE_WIDTH - w - 5;
    const y0 = 24;
    const g = this.radar.clear();
    if (this.tut) return;
    g.fillStyle(0x1a2236, 0.75).fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    g.fillStyle(0x4c9c44, 0.9).fillRect(x0, y0, w, h);
    g.lineStyle(1, 0xf0f0e8, 0.6).strokeRect(x0, y0, w, h).lineBetween(x0 + w / 2, y0, x0 + w / 2, y0 + h);
    for (const p of this.players) {
      g.fillStyle(p.human ? 0xf8e070 : p.team === 0 ? 0x5a8ae8 : 0x2a6a3a, 1).fillRect(x0 + Math.round((p.x / FW) * w) - 1, y0 + Math.round((p.y / FH) * h) - 1, 2, 2);
    }
    g.fillStyle(0xffffff, 1).fillRect(x0 + Math.round((this.ball.x / FW) * w), y0 + Math.round((this.ball.y / FH) * h), 1, 1);
  }

  private showBanner(title: string, subtitle: string): void {
    this.bannerText.setText(`${title}\n${subtitle}`).setVisible(true);
    const w = Math.max(160, this.bannerText.width + 20);
    const h = this.bannerText.height + 12;
    this.bannerBg.clear().setVisible(true);
    drawPanel(this.bannerBg, BASE_WIDTH / 2 - w / 2, 66 - h / 2, w, h, { radius: 6, fill: THEME.dark, edge: 0x5a6a90, alpha: 0.92 });
  }

  private hideBanner(): void {
    this.bannerText.setVisible(false);
    this.bannerBg.setVisible(false);
  }

  /** Textito que sube sobre un jugador ("¡Pásala!", "¡Atajada!"). */
  private popText(p: Player, text: string, high = false): void {
    const t = makeText(this, p.x + MARGIN, p.y + MARGIN - (high ? 28 : 18), text, { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff', stroke: '#1a2236', strokeThickness: 2 })
      .setOrigin(0.5, 1)
      .setDepth(9600);
    this.hudCam.ignore(t);
    this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
