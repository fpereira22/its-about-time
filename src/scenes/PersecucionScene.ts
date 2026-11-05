import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { playerLook } from '../systems/PlayerLook';
import { THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

/**
 * Misión 6: ¡al ladrón! Un raponero le arranca a Sira la bolsa con el libro firmado y sale corriendo por el
 * Bulevar del Río, cruza el Puente Ortiz y se mete entre los toldos. Vista de lado, corre solo hacia la derecha.
 *
 * Controles: D (o →) acelera (gasta aliento), A frena, W / E salta, S se desliza por debajo.
 * Obstáculos: huacales de libros y la carreta del pandebono (saltar), pendones y cuerdas de los toldos
 * (deslizarse), la estatua humana (saltar), palomas (pasar rápido) y los libros que te tira el ladrón.
 * Lo alcanzas si llegas a su lado antes de que se escape (45 s o 40 m de ventaja).
 */

export interface PersecucionResult {
  caught: boolean;
  /** Veces que chocaste con algo. */
  hits: number;
  /** Obstáculos esquivados. */
  dodges: number;
}

export interface PersecucionSceneData {
  done: (r: PersecucionResult) => void;
}

type ObKind = 'huacal' | 'pendon' | 'carreta' | 'estatua' | 'libro' | 'palomas' | 'charco';

interface Obstacle {
  kind: ObKind;
  /** Posición en el mundo (m). */
  x: number;
  hit: boolean;
  passed: boolean;
}

const GROUND = 146;
const PX_PER_M = 14;
const PLAYER_X = 90;
const BASE_SPEED = 6.2;
const SPRINT = 3.4;
const THIEF_SPEED = 7.1;
const GRAVITY = 900;
const JUMP_V = -300;
const SLIDE_S = 0.6;
const LIMIT_MS = 45_000;
const START_GAP = 14;
const ESCAPE_GAP = 40;
const SEGMENTS = [
  { at: 0, name: 'Bulevar del Río' },
  { at: 120, name: 'Puente Ortiz' },
  { at: 175, name: 'Monumento a Jorge Isaacs' },
  { at: 230, name: 'Bulevar · los toldos' },
];

export class PersecucionScene extends BaseScene {
  private done!: (r: PersecucionResult) => void;
  private bg!: Phaser.GameObjects.Graphics;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private topText!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private bannerText!: Phaser.GameObjects.Text;
  private shout!: Phaser.GameObjects.Text;
  private me!: HumanLook;
  private sira!: HumanLook;
  private thiefLook!: HumanLook;
  private dist = 0;
  private speed = BASE_SPEED;
  private thief = START_GAP;
  private thiefV = THIEF_SPEED;
  private y = 0;
  private vy = 0;
  private slide = 0;
  private stun = 0;
  private breath = 1;
  private obstacles: Obstacle[] = [];
  private nextOb = 10;
  private throwIn = 5;
  private hits = 0;
  private dodges = 0;
  private elapsed = 0;
  private t = 0;
  private bannerMs = 0;
  private shoutMs = 0;
  private state: 'intro' | 'run' | 'end' = 'intro';
  private caught = false;
  private segment = 0;

  constructor() {
    super('Persecucion');
    this.fixedCamera = true;
  }

  init(data: PersecucionSceneData): void {
    this.done = data.done;
    this.dist = 0;
    this.speed = BASE_SPEED;
    this.thief = START_GAP;
    this.thiefV = THIEF_SPEED;
    this.y = 0;
    this.vy = 0;
    this.slide = 0;
    this.stun = 0;
    this.breath = 1;
    this.obstacles = [];
    this.nextOb = 10;
    this.throwIn = 5;
    this.hits = 0;
    this.dodges = 0;
    this.elapsed = 0;
    this.t = 0;
    this.state = 'intro';
    this.caught = false;
    this.segment = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#f0b878');
    this.bg = this.add.graphics();
    this.g = this.add.graphics().setDepth(2);
    this.hud = this.add.graphics().setDepth(10);
    this.me = playerLook();
    this.sira = (characterLook('sira_feria') as HumanLook | undefined) ?? this.me;
    this.thiefLook = (characterLook('raponero') as HumanLook | undefined) ?? { ...this.me, shirt: '#3a3a44', hairStyle: 'cap', cap: '#c83c3c' };
    this.topText = this.addText(6, 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff', stroke: '#2a2433', strokeThickness: 2 }).setDepth(11);
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 11, 'D: correr más · W/E: saltar · S: deslizarse · A: frenar', { fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5, 0)
      .setDepth(11);
    this.shout = this.addText(0, 0, '', { fontSize: '9px', fontStyle: '600', color: '#ffffff', stroke: '#2a2433', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(12);
    this.bannerBg = this.add.graphics().setDepth(13);
    this.bannerText = this.addText(BASE_WIDTH / 2, 80, '', { fontSize: '12px', fontStyle: '600', color: THEME.ink, align: 'center', wordWrap: { width: 250 } })
      .setOrigin(0.5)
      .setDepth(14);
    this.setupZoom();
    playMusic('persecucion');
    playSfx('raponazo');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.banner('¡AL LADRÓN!\nSe lleva la bolsa de Sira con el libro firmado', 2200);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    if (this.bannerMs > 0) {
      this.bannerMs -= delta;
      if (this.bannerMs <= 0) this.hideBanner();
    }
    if (this.shoutMs > 0) {
      this.shoutMs -= delta;
      if (this.shoutMs <= 0) this.shout.setText('');
    }
    if (this.state === 'intro') {
      if (this.bannerMs <= 0 || Controls.consume('interact')) {
        this.hideBanner();
        this.state = 'run';
      }
      this.render();
      return;
    }
    if (this.state === 'end') {
      if (Controls.consume('interact') || Controls.consume('menu')) this.finish();
      this.render();
      return;
    }
    this.elapsed += delta;
    this.control(dt);
    this.spawn();
    this.collide();
    // El ladrón: acelera y frena (mira para atrás), y a veces tira libros.
    this.thiefV = THIEF_SPEED + Math.sin(this.t * 0.9) * 1.1 - (this.thief - this.dist < 6 ? 0.6 : 0);
    this.thief += this.thiefV * dt;
    this.throwIn -= dt;
    if (this.throwIn <= 0) {
      this.throwIn = 3.5 + Math.random() * 3;
      this.obstacles.push({ kind: 'libro', x: this.thief - 1, hit: false, passed: false });
      this.say(this.thief, '¡Tome, lea!', 900);
    }
    const seg = SEGMENTS.reduce((acc, s, i) => (this.dist >= s.at ? i : acc), 0);
    if (seg !== this.segment) {
      this.segment = seg;
      this.banner(SEGMENTS[seg].name, 1200);
    }
    const gap = this.thief - this.dist;
    if (gap < 1.2) {
      this.caught = true;
      this.end('¡LO ALCANZASTE!\nLo agarras de la camisa; suelta la bolsa y se tira al río (poco profundo). Sale corriendo, empapado.');
    } else if (gap > ESCAPE_GAP || this.elapsed > LIMIT_MS) {
      this.end('Se te escapa entre la gente...\n...y una señora con un termo de tinto le pone el pie. ¡PUM! La bolsa sale volando.');
    }
    this.render();
  }

  private control(dt: number): void {
    if (this.stun > 0) {
      this.stun -= dt;
      this.speed = Math.max(2, this.speed - dt * 8);
    } else {
      let target = BASE_SPEED;
      if ((Controls.isHeld('right')) && this.breath > 0.05) {
        target += SPRINT;
        this.breath = Math.max(0, this.breath - dt * 0.15);
      } else {
        this.breath = Math.min(1, this.breath + dt * 0.16);
      }
      if (Controls.isHeld('left')) target -= 2.5;
      this.speed += (target - this.speed) * Math.min(1, dt * 3);
    }
    const onGround = this.y >= 0;
    if ((Controls.consume('up') || Controls.consume('interact')) && onGround && this.slide <= 0 && this.stun <= 0) {
      this.vy = JUMP_V;
      playSfx('salto');
    }
    if (Controls.consume('down') && onGround && this.slide <= 0) this.slide = SLIDE_S;
    this.vy += GRAVITY * dt;
    this.y = Math.min(0, this.y + this.vy * dt);
    if (this.y >= 0) this.vy = 0;
    this.slide = Math.max(0, this.slide - dt);
    this.dist += this.speed * dt;
  }

  private spawn(): void {
    while (this.nextOb < this.dist + 30) {
      const seg = SEGMENTS.reduce((acc, s, i) => (this.nextOb >= s.at ? i : acc), 0);
      const pool: ObKind[] =
        seg === 1 ? ['huacal', 'charco', 'palomas', 'pendon'] : seg === 2 ? ['estatua', 'palomas', 'huacal', 'charco'] : ['huacal', 'pendon', 'carreta', 'pendon', 'huacal'];
      const kind = pool[Math.floor(Math.random() * pool.length)];
      this.obstacles.push({ kind, x: this.nextOb, hit: false, passed: false });
      this.nextOb += 6 + Math.random() * 6;
    }
    this.obstacles = this.obstacles.filter((o) => o.x > this.dist - 10);
  }

  private collide(): void {
    for (const o of this.obstacles) {
      if (o.hit || o.passed) continue;
      const dx = o.x - this.dist;
      if (dx > 0.6) continue;
      if (dx < -0.6) {
        o.passed = true;
        this.dodges++;
        continue;
      }
      const high = this.y < -18;
      const low = this.slide > 0;
      const ok =
        o.kind === 'pendon' ? low : o.kind === 'palomas' ? this.speed > BASE_SPEED + 1 || high : o.kind === 'charco' ? high || low : high;
      if (ok) continue;
      o.hit = true;
      this.hits++;
      this.stun = o.kind === 'palomas' || o.kind === 'charco' ? 0.35 : 0.7;
      playSfx(o.kind === 'palomas' ? 'pavo' : 'golpe');
      this.cameras.main.shake(180, 0.006);
      const lines: Record<ObKind, string> = {
        huacal: '¡Auch, los huacales!',
        pendon: '¡El pendón en la cara!',
        carreta: '¡La carreta del pandebono!',
        estatua: '¡Perdón, señor estatua!',
        libro: '¡Un diccionario en la canilla!',
        palomas: '¡Palomas!',
        charco: '¡Splash!',
      };
      this.say(this.dist, lines[o.kind], 900);
    }
  }

  private end(text: string): void {
    this.state = 'end';
    playSfx(this.caught ? 'gol' : 'golpe');
    this.banner(`${text}\n\n(E para seguir)`, 0);
  }

  private finish(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.done({ caught: this.caught, hits: this.hits, dodges: this.dodges }));
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private sx(worldM: number): number {
    return Math.round(PLAYER_X + (worldM - this.dist) * PX_PER_M);
  }

  private render(): void {
    this.drawBackground();
    const g = this.g;
    g.clear();
    for (const o of this.obstacles) this.drawObstacle(g, o);
    // Sira, atrás, gritando.
    const sx = PLAYER_X - 46 + Math.sin(this.t * 2) * 4;
    this.runner(g, sx, GROUND, this.sira, this.t * 11, 0, false);
    if (Math.floor(this.t * 0.6) % 4 === 0) this.sayAt(sx, '¡Mi libro!');
    // El ladrón.
    const tx = this.sx(this.thief);
    if (tx < BASE_WIDTH + 30) {
      this.runner(g, tx, GROUND, this.thiefLook, this.t * 13, 0, false);
      g.fillStyle(0xe8a0b8, 1).fillRect(tx - 9, GROUND - 16, 6, 7);
      g.fillStyle(0x2a2433, 1).fillRect(tx - 8, GROUND - 18, 4, 2);
    } else {
      g.fillStyle(0xffffff, 1).fillTriangle(BASE_WIDTH - 6, 90, BASE_WIDTH - 14, 84, BASE_WIDTH - 14, 96);
    }
    // Tú.
    this.runner(g, PLAYER_X, GROUND + this.y, this.me, this.stun > 0 ? 0 : this.t * (6 + this.speed * 1.4), this.slide > 0 ? 1 : 0, this.stun > 0);
    if (this.speed > BASE_SPEED + 1.5 && this.stun <= 0) {
      for (let i = 0; i < 3; i++) g.fillStyle(0xffffff, 0.7).fillRect(PLAYER_X - 18 - i * 6, GROUND - 14 + i * 4 + this.y, 5, 1);
    }
    this.drawHud();
  }

  private drawBackground(): void {
    const g = this.bg;
    g.clear();
    // Atardecer sobre el río Cali.
    const sky = [0xf8d4a4, 0xf4bc8c, 0xeca484, 0xd88c88];
    sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 18, BASE_WIDTH, 19));
    // La Ermita y los Farallones a lo lejos (paralaje lento).
    const far = -(this.dist * 2) % 400;
    for (let k = 0; k < 2; k++) {
      const ox = far + k * 400;
      g.fillStyle(0x8a7c9c, 1).fillTriangle(ox + 20, 72, ox + 120, 40, ox + 220, 72).fillTriangle(ox + 180, 72, ox + 300, 46, ox + 400, 72);
      g.fillStyle(0xf0ece6, 1).fillRect(ox + 250, 48, 30, 26);
      g.fillStyle(0x9ca4b4, 1).fillTriangle(ox + 250, 48, ox + 256, 30, ox + 262, 48).fillTriangle(ox + 268, 48, ox + 274, 30, ox + 280, 48);
      g.fillStyle(0x9ca4b4, 1).fillTriangle(ox + 259, 48, ox + 265, 22, ox + 271, 48);
    }
    // Palmas y toldos (paralaje medio).
    const mid = -(this.dist * 6) % 160;
    for (let k = 0; k < 4; k++) {
      const ox = mid + k * 160;
      g.fillStyle(0x6a4c2c, 1).fillRect(ox + 20, 66, 3, 42);
      g.fillStyle(0x3c9050, 1).fillRect(ox + 8, 62, 28, 5).fillRect(ox + 4, 66, 8, 4).fillRect(ox + 32, 66, 8, 4);
      const colors = [0xe05a4c, 0x3c78c8, 0xf0c040, 0x48a868];
      g.fillStyle(colors[k % 4], 1).fillTriangle(ox + 60, 96, ox + 90, 78, ox + 120, 96);
      g.fillStyle(0xf4f2ec, 1).fillRect(ox + 62, 96, 56, 14);
      g.fillStyle(0x8a5430, 1).fillRect(ox + 64, 104, 52, 6);
    }
    // El suelo: bulevar o los ladrillos del puente (con el río abajo).
    const onBridge = this.segment === 1;
    g.fillStyle(onBridge ? 0x5a8c8c : 0xd8c8b0, 1).fillRect(0, 110, BASE_WIDTH, 36);
    if (onBridge) {
      for (let x = -(this.dist * 10) % 30; x < BASE_WIDTH; x += 30) g.fillStyle(0x84b4ac, 1).fillRect(x, 120, 14, 1);
      g.fillStyle(0xb4604a, 1).fillRect(0, 112, BASE_WIDTH, 10);
      for (let x = -(this.dist * PX_PER_M) % 24; x < BASE_WIDTH; x += 24) g.fillStyle(0x8a4434, 1).fillRect(x, 112, 4, 10);
    }
    g.fillStyle(onBridge ? 0xb4604a : 0xc8b090, 1).fillRect(0, GROUND, BASE_WIDTH, BASE_HEIGHT - GROUND);
    for (let x = -(this.dist * PX_PER_M) % 16; x < BASE_WIDTH; x += 16) g.fillStyle(onBridge ? 0x8a4434 : 0xbca88c, 1).fillRect(x, GROUND, 1, BASE_HEIGHT - GROUND);
    g.fillStyle(0x000000, 0.2).fillRect(0, GROUND, BASE_WIDTH, 2);
  }

  private drawObstacle(g: Phaser.GameObjects.Graphics, o: Obstacle): void {
    const x = this.sx(o.x);
    if (x < -40 || x > BASE_WIDTH + 40) return;
    const ink = 0x2a2433;
    switch (o.kind) {
      case 'huacal':
        g.fillStyle(ink, 1).fillRect(x - 9, GROUND - 15, 18, 15);
        g.fillStyle(0xc89058, 1).fillRect(x - 8, GROUND - 14, 16, 13);
        for (let i = 0; i < 6; i++) g.fillStyle([0xc83c3c, 0x2f6fd0, 0x3cae5c, 0xf0c030][i % 4], 1).fillRect(x - 7 + i * 2.5, GROUND - 18, 2, 5);
        break;
      case 'pendon':
        // Pendón colgado entre dos postes: hay que pasar por debajo.
        g.fillStyle(ink, 1).fillRect(x - 14, GROUND - 46, 2, 46).fillRect(x + 12, GROUND - 46, 2, 46);
        g.fillStyle(0x2c7cb0, 1).fillRect(x - 12, GROUND - 40, 24, 16);
        g.fillStyle(0xf8f4e8, 1).fillRect(x - 9, GROUND - 35, 18, 2).fillRect(x - 9, GROUND - 30, 12, 2);
        break;
      case 'carreta':
        g.fillStyle(ink, 1).fillRect(x - 14, GROUND - 20, 28, 14);
        g.fillStyle(0xf0c040, 1).fillRect(x - 13, GROUND - 19, 26, 12);
        g.fillStyle(0xf8e8c0, 1).fillCircle(x - 6, GROUND - 22, 3).fillCircle(x + 2, GROUND - 22, 3).fillCircle(x + 9, GROUND - 22, 3);
        g.fillStyle(ink, 1).fillCircle(x - 8, GROUND - 4, 4).fillCircle(x + 8, GROUND - 4, 4);
        break;
      case 'estatua':
        g.fillStyle(0xc8c8c0, 1).fillRect(x - 10, GROUND - 6, 20, 6);
        g.fillStyle(0xd8d8d0, 1).fillRect(x - 4, GROUND - 26, 8, 20).fillRect(x - 3, GROUND - 33, 6, 7).fillRect(x + 4, GROUND - 26, 7, 3);
        break;
      case 'libro':
        g.fillStyle(ink, 1).fillRect(x - 6, GROUND - 8, 12, 8);
        g.fillStyle(0x9c5cc8, 1).fillRect(x - 5, GROUND - 7, 10, 6);
        g.fillStyle(0xf8f4e8, 1).fillRect(x - 5, GROUND - 3, 10, 1);
        break;
      case 'palomas':
        for (let i = 0; i < 5; i++) {
          const fx = x - 10 + i * 5;
          const fy = GROUND - 4 - (o.hit ? (this.t * 40 + i * 9) % 40 : 0);
          g.fillStyle(0x7a7c88, 1).fillRect(fx, fy - 3, 4, 3);
          g.fillStyle(0xa8aab4, 1).fillRect(fx + 3, fy - 4, 2, 2);
        }
        break;
      case 'charco':
        g.fillStyle(0x84b4ac, 1).fillEllipse(x, GROUND + 2, 30, 6);
        g.fillStyle(0xd4ece4, 1).fillRect(x - 6, GROUND + 1, 6, 1);
        break;
    }
  }

  /** Corredor de lado (mirando a la derecha): piernas y brazos en tijera, o deslizándose, o tropezando. */
  private runner(g: Phaser.GameObjects.Graphics, x: number, foot: number, look: HumanLook, phase: number, slide: number, stumble: boolean): void {
    const hc = (c: string): number => Phaser.Display.Color.HexStringToColor(c).color;
    const ink = 0x2a2433;
    if (slide > 0) {
      g.fillStyle(ink, 1).fillRect(x - 14, foot - 10, 28, 9);
      g.fillStyle(hc(look.pants), 1).fillRect(x - 13, foot - 7, 14, 5);
      g.fillStyle(hc(look.shirt), 1).fillRect(x, foot - 9, 9, 6);
      g.fillStyle(hc(look.skin), 1).fillRect(x + 8, foot - 12, 6, 6);
      g.fillStyle(hc(look.hair), 1).fillRect(x + 8, foot - 13, 6, 2);
      g.fillStyle(0xffffff, 0.7).fillRect(x - 20, foot - 2, 6, 1);
      return;
    }
    const lean = stumble ? -3 : 2;
    const a = Math.sin(phase);
    const b = Math.sin(phase + Math.PI);
    // Piernas.
    g.fillStyle(hc(look.pants), 1);
    g.fillRect(x - 2 + Math.round(a * 5), foot - 9, 3, 9).fillRect(x - 1 + Math.round(b * 5), foot - 9, 3, 9);
    g.fillStyle(hc(look.shoes ?? '#e8e8e0'), 1).fillRect(x - 2 + Math.round(a * 5), foot - 2, 4, 2).fillRect(x - 1 + Math.round(b * 5), foot - 2, 4, 2);
    // Torso.
    g.fillStyle(ink, 1).fillRect(x - 5 + lean, foot - 21, 10, 13);
    g.fillStyle(hc(look.shirt), 1).fillRect(x - 4 + lean, foot - 20, 8, 11);
    // Brazos.
    g.fillStyle(hc(look.skin), 1).fillRect(x - 1 + lean + Math.round(b * 5), foot - 19, 2, 8).fillRect(x + lean + Math.round(a * 5), foot - 19, 2, 8);
    // Cabeza.
    g.fillStyle(ink, 1).fillRect(x - 4 + lean, foot - 30, 9, 10);
    g.fillStyle(hc(look.skin), 1).fillRect(x - 3 + lean, foot - 29, 7, 8);
    if (look.hairStyle === 'cap') g.fillStyle(hc(look.cap ?? '#c83c3c'), 1).fillRect(x - 4 + lean, foot - 31, 10, 3).fillRect(x + 4 + lean, foot - 29, 3, 1);
    else if (look.hairStyle === 'long') g.fillStyle(hc(look.hair), 1).fillRect(x - 4 + lean, foot - 31, 9, 3).fillRect(x - 5 + lean, foot - 29, 3, 9);
    else if (look.hairStyle !== 'bald') g.fillStyle(hc(look.hair), 1).fillRect(x - 4 + lean, foot - 31, 9, 3);
    g.fillStyle(0x202028, 1).fillRect(x + 2 + lean, foot - 26, 1, 2);
    if (stumble) {
      for (let i = 0; i < 3; i++) g.fillStyle(0xf8e070, 1).fillRect(x - 6 + i * 6, foot - 36 - (i % 2) * 2, 2, 2);
    }
  }

  private drawHud(): void {
    const h = this.hud;
    h.clear();
    h.fillStyle(0x14182a, 0.7).fillRect(0, 0, BASE_WIDTH, 15).fillRect(0, BASE_HEIGHT - 13, BASE_WIDTH, 13);
    const gap = Math.max(0, this.thief - this.dist);
    // Barra de distancia: tú, el ladrón y el límite donde se escapa.
    const x0 = 120;
    const w = 150;
    h.fillStyle(0x3a4060, 1).fillRoundedRect(x0, 5, w, 5, 2);
    const k = Phaser.Math.Clamp(gap / ESCAPE_GAP, 0, 1);
    h.fillStyle(0xf8e070, 1).fillCircle(x0, 7, 3);
    h.fillStyle(0xe85a5a, 1).fillCircle(x0 + w * k, 7, 3);
    // Aliento.
    h.fillStyle(0x3a4060, 1).fillRoundedRect(BASE_WIDTH - 44, 5, 38, 5, 2);
    h.fillStyle(this.breath < 0.25 ? 0xff7a7a : 0x8ae08a, 1).fillRoundedRect(BASE_WIDTH - 44, 5, Math.max(2, 38 * this.breath), 5, 2);
    const secs = Math.max(0, Math.ceil((LIMIT_MS - this.elapsed) / 1000));
    this.topText.setText(`${Math.round(gap)} m · ${secs} s`);
  }

  private say(worldM: number, text: string, ms: number): void {
    this.shout.setText(text).setPosition(Phaser.Math.Clamp(this.sx(worldM), 40, BASE_WIDTH - 40), GROUND - 40);
    this.shoutMs = ms;
  }

  private sayAt(x: number, text: string): void {
    if (this.shoutMs > 0) return;
    this.shout.setText(text).setPosition(Math.max(40, x), GROUND - 38);
    this.shoutMs = 700;
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
