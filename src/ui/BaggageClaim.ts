import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import type { MapScene } from '../scenes/MapScene';
import { Controls } from '../systems/Controls';
import { drawPanel, makeText, THEME } from './theme';

const DEPTH = 210;
const FADE_MS = 160;

/** La cinta vista desde arriba: un estadio (dos rectas y dos semicírculos). */
const BELT = { cx: 160, cy: 110, half: 92, r: 36, width: 22 };
const PERIMETER = 4 * BELT.half + 2 * Math.PI * BELT.r;
const SPEED = 26;
/** Las maletas salen por la boca de la cinta (arriba a la izquierda) y avanzan en sentido horario. */
const CHUTE_S = 18;
const BAG_GAP = 30;
const SPAWN_MS = 1500;
const PICKUP_MS = 2600;
const MAX_BAGS = 13;
/** La tuya sale después de varias otras (siempre la última, obvio). */
const YOURS_AFTER = 9;

type Look =
  | { kind: 'hard'; body: number; band: number; stripe?: number; tag?: number; tagAt?: 'side' | 'handle'; sticker?: number }
  | { kind: 'duffel'; body: number; strap: number }
  | { kind: 'box'; label: string };

interface BagDef {
  look: Look;
  /** Por qué no es la tuya (lo piensa el personaje al hacerle clic). */
  why?: string;
  mine?: boolean;
}

const YOURS: BagDef = { mine: true, look: { kind: 'hard', body: 0x2f4a8c, band: 0x4a6ab8, stripe: 0x1e3060, tag: 0xf0d048, tagAt: 'side' } };

/** Las que se parecen a la tuya (para que haya que mirar con calma). */
const DECOYS: BagDef[] = [
  { look: { kind: 'hard', body: 0x2f4a8c, band: 0x4a6ab8, stripe: 0x1e3060 }, why: 'Azul, sí... pero no tiene la cinta amarilla.' },
  { look: { kind: 'hard', body: 0x2f4a8c, band: 0x4a6ab8, stripe: 0x1e3060, tag: 0xd04848, tagAt: 'side' }, why: 'Esa tiene la cinta roja. La tuya es amarilla.' },
  { look: { kind: 'hard', body: 0x3c6cd0, band: 0x6a94e8, stripe: 0x2a54a8, tag: 0xf0d048, tagAt: 'side' }, why: 'Esa es de un azul más clarito. Casi.' },
  { look: { kind: 'hard', body: 0x2f4a8c, band: 0x4a6ab8, tag: 0xf0d048, tagAt: 'handle' }, why: 'La cinta va en la manilla y no tiene la franja del medio. No es.' },
];

const OTHERS: BagDef[] = [
  { look: { kind: 'hard', body: 0xc83838, band: 0xe05858, stripe: 0x902020 } },
  { look: { kind: 'hard', body: 0xc83838, band: 0xe05858, tag: 0x58c878, tagAt: 'handle' } },
  { look: { kind: 'hard', body: 0x26262e, band: 0x3a3a44, stripe: 0x18181e } },
  { look: { kind: 'hard', body: 0x26262e, band: 0x3a3a44, sticker: 0xe8e8e0 } },
  { look: { kind: 'hard', body: 0x48a858, band: 0x68c878, stripe: 0x307840 } },
  { look: { kind: 'hard', body: 0x9c6cb8, band: 0xb88cd0, sticker: 0xf0c030 } },
  { look: { kind: 'hard', body: 0x6a6c78, band: 0x8a8c98, stripe: 0x4a4c58, tag: 0xe88838, tagAt: 'side' } },
  { look: { kind: 'hard', body: 0xe8e0c8, band: 0xfff8e8, stripe: 0xc8b088 } },
  { look: { kind: 'duffel', body: 0x5a6a3c, strap: 0x3a4a24 } },
  { look: { kind: 'duffel', body: 0xd06090, strap: 0x903060 } },
  { look: { kind: 'box', label: 'VINO' } },
  { look: { kind: 'box', label: 'FRÁGIL' } },
];

const NOT_EVEN_CLOSE = ['Esa ni se parece a la tuya.', '¡Oiga, esa es mía! —te dice una señora.', 'Esa es de otro. La tuya es azul con cinta amarilla.'];

interface Bag {
  def: BagDef;
  s: number;
  view: Phaser.GameObjects.Container;
  leaving: boolean;
}

export interface BaggageResult {
  found: boolean;
  mistakes: number;
}

/**
 * Cinta de equipaje de Cali (misión 3): las maletas dan vueltas y hay que hacer clic en la tuya.
 * Se abre con el evento 'open-baggage-claim'; Esc deja de buscar (se puede volver a intentar).
 */
export class BaggageClaim {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;
  private belt: Phaser.GameObjects.Graphics | null = null;
  private bagLayer: Phaser.GameObjects.Container | null = null;
  private thought: Phaser.GameObjects.Container | null = null;
  private bags: Bag[] = [];
  private queue: BagDef[] = [];
  private map: MapScene | null = null;
  private done: ((result: BaggageResult) => void) | null = null;
  private active = false;
  private finishing = false;
  private mistakes = 0;
  private beltOffset = 0;
  private spawnIn = 0;
  private pickupIn = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.overlay = scene.add
      .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x0a0e18, 1)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setVisible(false)
      .setDepth(DEPTH);
    this.root = scene.add.container(0, 0).setDepth(DEPTH + 1);
  }

  get isOpen(): boolean {
    return this.active;
  }

  open(map: MapScene, done: (result: BaggageResult) => void): void {
    this.map = map;
    this.done = done;
    this.active = true;
    this.finishing = false;
    this.mistakes = 0;
    this.spawnIn = 0;
    this.pickupIn = PICKUP_MS * 2;
    if (!this.scene.scene.isPaused(map.scene.key)) this.scene.scene.pause(map.scene.key);
    playSfx('open');
    this.scene.tweens.killTweensOf([this.overlay, this.root]);
    this.overlay.setVisible(true);
    this.scene.tweens.add({ targets: this.overlay, alpha: 0.8, duration: FADE_MS });
    this.build();
    this.root.setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: FADE_MS });
  }

  update(delta: number): void {
    if (!this.active) return;
    if (!this.finishing && Controls.consume('menu')) return this.close(false);
    const dt = delta / 1000;
    this.beltOffset = (this.beltOffset + SPEED * dt) % 8;
    this.drawBelt();

    for (const bag of this.bags) {
      if (bag.leaving) continue;
      bag.s = (bag.s + SPEED * dt) % PERIMETER;
      const p = pointAt(bag.s);
      bag.view.setPosition(p.x, p.y);
    }
    // Las de la recta de abajo quedan delante.
    this.bagLayer?.sort('y');

    if (this.finishing) return;
    this.spawnIn -= delta;
    if (this.spawnIn <= 0 && this.queue.length > 0 && this.bags.length < MAX_BAGS && this.chuteClear()) {
      this.spawn(this.queue.shift()!, CHUTE_S);
      this.spawnIn = SPAWN_MS;
    }
    this.pickupIn -= delta;
    if (this.pickupIn <= 0) {
      this.pickupIn = PICKUP_MS;
      this.someoneTakesABag();
    }
  }

  private build(): void {
    this.root.removeAll(true);
    this.bags = [];

    const top = this.scene.add.graphics();
    drawPanel(top, 8, 6, 304, 32, { radius: 5, fill: THEME.dark, edge: 0x0a0e18 });
    this.root.add(top);
    this.root.add(makeText(this.scene, 16, 10, 'CINTA 2 · CA 742 SANTIAGO', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0c030' }));
    this.root.add(makeText(this.scene, 16, 22, 'Haz clic en tu maleta cuando pase · Esc: seguir esperando', { fontSize: '8px', color: '#b8c4e0' }));

    // Ficha con la maleta que buscas (en la barra, a la derecha).
    const ref = this.scene.add.graphics();
    drawPanel(ref, 266, 9, 42, 26, { radius: 3, shadow: false });
    this.root.add(ref);
    this.root.add(makeText(this.scene, 287, 10, 'TU MALETA', { fontSize: '6px', fontStyle: '600', color: THEME.ink }).setOrigin(0.5, 0));
    const refBag = this.scene.add.graphics();
    drawBag(refBag, YOURS.look);
    this.root.add(this.scene.add.container(287, 25, [refBag]));

    this.belt = this.scene.add.graphics();
    this.root.add(this.belt);
    this.drawBelt();
    this.bagLayer = this.scene.add.container(0, 0);
    this.root.add(this.bagLayer);
    // Boca de la cinta (de donde salen las maletas), encima de todo.
    const chute = this.scene.add.graphics();
    const c = pointAt(CHUTE_S - 14);
    chute.fillStyle(0x2a3048, 1).fillRect(c.x - 12, c.y - 18, 24, 12);
    for (let i = 0; i < 6; i++) chute.fillStyle(i % 2 ? 0x1c2034 : 0x3a4460, 1).fillRect(c.x - 12 + i * 4, c.y - 6, 4, 6);
    this.root.add(chute);

    // Ya hay algunas dando vueltas; la tuya sale después de YOURS_AFTER maletas.
    const others = Phaser.Utils.Array.Shuffle([...OTHERS]);
    const decoys = Phaser.Utils.Array.Shuffle([...DECOYS]);
    for (let i = 0; i < 6; i++) this.spawn(i % 3 === 1 ? decoys.pop()! : others.pop()!, CHUTE_S + 40 + i * (PERIMETER / 7));
    const rest = Phaser.Utils.Array.Shuffle([...others, ...decoys]);
    rest.splice(Math.min(rest.length, YOURS_AFTER - 6), 0, YOURS);
    // Y otras que se parecen salen justo después, para confundir.
    this.queue = [...rest, ...Phaser.Utils.Array.Shuffle([...DECOYS])];
  }

  private drawBelt(): void {
    const g = this.belt;
    if (!g) return;
    const { cx, cy, half, r, width } = BELT;
    g.clear();
    // Borde metálico, cinta y centro.
    g.fillStyle(0x6a7088, 1).fillRoundedRect(cx - half - r - width / 2 - 3, cy - r - width / 2 - 3, (half + r) * 2 + width + 6, (r * 2) + width + 6, r + width / 2 + 3);
    g.fillStyle(0x2a2e3c, 1).fillRoundedRect(cx - half - r - width / 2, cy - r - width / 2, (half + r) * 2 + width, r * 2 + width, r + width / 2);
    // Láminas de la cinta, que avanzan.
    g.lineStyle(1, 0x1c1f2a, 1);
    for (let s = this.beltOffset; s < PERIMETER; s += 8) {
      const p = pointAt(s);
      const nx = Math.cos(((p.angle + 90) * Math.PI) / 180);
      const ny = Math.sin(((p.angle + 90) * Math.PI) / 180);
      g.lineBetween(p.x - nx * (width / 2), p.y - ny * (width / 2), p.x + nx * (width / 2), p.y + ny * (width / 2));
    }
    g.fillStyle(0x6a7088, 1).fillRoundedRect(cx - half - r + width / 2 - 3, cy - r + width / 2 - 3, (half + r) * 2 - width + 6, r * 2 - width + 6, r - width / 2 + 3);
    g.fillStyle(0x4a5068, 1).fillRoundedRect(cx - half - r + width / 2, cy - r + width / 2, (half + r) * 2 - width, r * 2 - width, r - width / 2);
    g.fillStyle(0x3a4058, 1).fillRect(cx - half, cy - 2, half * 2, 4);
  }

  private spawn(def: BagDef, s: number): void {
    const g = this.scene.add.graphics();
    drawBag(g, def.look);
    const view = this.scene.add.container(0, 0, [g]).setSize(20, 18);
    const p = pointAt(s);
    view.setPosition(p.x, p.y);
    view.setInteractive({ useHandCursor: true });
    const bag: Bag = { def, s, view, leaving: false };
    view.on('pointerover', () => !this.finishing && !bag.leaving && view.setScale(1.2));
    view.on('pointerout', () => view.setScale(1));
    view.on('pointerdown', () => this.pick(bag));
    this.bagLayer?.add(view);
    this.bags.push(bag);
    if (s === CHUTE_S) {
      view.setScale(0.4).setAlpha(0);
      this.scene.tweens.add({ targets: view, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    }
  }

  /** No sale una maleta encima de otra. */
  private chuteClear(): boolean {
    return this.bags.every((b) => b.leaving || Math.abs(b.s - CHUTE_S) > BAG_GAP);
  }

  /** Otros pasajeros se van con sus maletas (nunca con la tuya ni con las que se parecen). */
  private someoneTakesABag(): void {
    const candidates = this.bags.filter((b) => !b.leaving && !b.def.mine && !b.def.why);
    const bag = Phaser.Utils.Array.GetRandom(candidates);
    if (!bag || this.bags.length < 6) return;
    this.removeBag(bag, 18);
  }

  private removeBag(bag: Bag, dy: number): void {
    bag.leaving = true;
    bag.view.disableInteractive();
    this.scene.tweens.add({
      targets: bag.view,
      y: bag.view.y + dy,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.In',
      onComplete: () => {
        bag.view.destroy();
        this.bags = this.bags.filter((b) => b !== bag);
      },
    });
  }

  private pick(bag: Bag): void {
    if (this.finishing || bag.leaving) return;
    if (bag.def.mine) {
      this.finishing = true;
      playSfx('item');
      bag.leaving = true;
      bag.view.disableInteractive();
      this.scene.tweens.add({
        targets: bag.view,
        x: BELT.cx,
        y: BELT.cy,
        scale: 2.4,
        duration: 420,
        ease: 'Cubic.Out',
      });
      this.think('¡Esa es! La última, obvio. Siempre la última.', BELT.cx, BELT.cy - 30);
      this.scene.time.delayedCall(1400, () => this.close(true));
      return;
    }
    this.mistakes++;
    playSfx('error');
    this.scene.tweens.add({ targets: bag.view, x: bag.view.x + 2, duration: 40, yoyo: true, repeat: 2 });
    this.think(bag.def.why ?? Phaser.Utils.Array.GetRandom(NOT_EVEN_CLOSE), bag.view.x, bag.view.y - 16);
  }

  /** Burbuja corta con lo que piensa el personaje. */
  private think(text: string, x: number, y: number): void {
    this.thought?.destroy();
    const t = makeText(this.scene, 0, 0, text, { fontSize: '8px', color: THEME.ink, wordWrap: { width: 150 } }).setOrigin(0.5);
    const w = Math.ceil(t.width) + 12;
    const h = Math.ceil(t.height) + 8;
    const bg = this.scene.add.graphics();
    drawPanel(bg, -w / 2, -h / 2, w, h, { radius: 4, shadow: false });
    const bx = Phaser.Math.Clamp(x, w / 2 + 4, BASE_WIDTH - w / 2 - 4);
    const by = Phaser.Math.Clamp(y, 44 + h / 2, BASE_HEIGHT - h / 2 - 4);
    const bubble = this.scene.add.container(bx, by, [bg, t]);
    this.root.add(bubble);
    this.thought = bubble;
    bubble.setAlpha(0);
    this.scene.tweens.add({ targets: bubble, alpha: 1, duration: 100 });
    this.scene.time.delayedCall(2200, () => {
      if (this.thought !== bubble) return;
      this.thought = null;
      this.scene.tweens.add({ targets: bubble, alpha: 0, duration: 200, onComplete: () => bubble.destroy() });
    });
  }

  private close(found: boolean): void {
    if (!this.active) return;
    this.active = false;
    playSfx('close');
    this.scene.input.manager.canvas.style.cursor = 'default';
    this.thought = null;
    this.belt = null;
    this.bagLayer = null;
    this.bags = [];
    this.queue = [];
    this.scene.tweens.killTweensOf([this.overlay, this.root]);
    this.scene.tweens.add({
      targets: [this.overlay, this.root],
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => {
        this.overlay.setVisible(false);
        this.root.removeAll(true);
      },
    });
    if (this.map) this.scene.scene.resume(this.map.scene.key);
    this.map = null;
    const done = this.done;
    this.done = null;
    done?.({ found, mistakes: this.mistakes });
  }
}

/** Punto de la cinta a `s` px del inicio de la recta de arriba (sentido horario) y su ángulo en grados. */
function pointAt(s: number): { x: number; y: number; angle: number } {
  const { cx, cy, half, r } = BELT;
  const straight = half * 2;
  const arc = Math.PI * r;
  s = ((s % PERIMETER) + PERIMETER) % PERIMETER;
  if (s < straight) return { x: cx - half + s, y: cy - r, angle: 0 };
  s -= straight;
  if (s < arc) {
    const a = -Math.PI / 2 + s / r;
    return { x: cx + half + Math.cos(a) * r, y: cy + Math.sin(a) * r, angle: (s / arc) * 180 };
  }
  s -= arc;
  if (s < straight) return { x: cx + half - s, y: cy + r, angle: 180 };
  s -= straight;
  const a = Math.PI / 2 + s / r;
  return { x: cx - half + Math.cos(a) * r, y: cy + Math.sin(a) * r, angle: 180 + (s / arc) * 180 };
}

/** Maleta vista de frente, centrada en (0, 0), de unos 16×16 px. */
function drawBag(g: Phaser.GameObjects.Graphics, look: Look): void {
  const outline = 0x1a1424;
  if (look.kind === 'box') {
    g.fillStyle(outline, 1).fillRect(-9, -7, 18, 14);
    g.fillStyle(0xc8965a, 1).fillRect(-8, -6, 16, 12);
    g.fillStyle(0xd8b078, 1).fillRect(-8, -6, 16, 3);
    g.fillStyle(0xe8d8a0, 1).fillRect(-1, -6, 2, 12);
    g.fillStyle(look.label === 'VINO' ? 0x8a2040 : 0xd04848, 1).fillRect(-7, 1, 5, 3);
    return;
  }
  if (look.kind === 'duffel') {
    g.fillStyle(outline, 1).fillRoundedRect(-10, -5, 20, 12, 5);
    g.fillStyle(look.body, 1).fillRoundedRect(-9, -4, 18, 10, 4);
    g.fillStyle(look.strap, 1).fillRect(-9, 0, 18, 2).fillRect(-4, -7, 8, 2);
    g.fillStyle(outline, 1).fillRect(-5, -7, 1, 3).fillRect(4, -7, 1, 3);
    return;
  }
  // Maleta rígida: cuerpo, franja de arriba, franja del medio, manilla, ruedas y cinta.
  g.fillStyle(0x4a4c58, 1).fillRect(-3, -9, 6, 1).fillRect(-3, -9, 1, 3).fillRect(2, -9, 1, 3);
  g.fillStyle(outline, 1).fillRect(-6, -6, 12, 14);
  g.fillStyle(look.body, 1).fillRect(-5, -5, 10, 12);
  g.fillStyle(look.band, 1).fillRect(-5, -5, 10, 2);
  if (look.stripe !== undefined) g.fillStyle(look.stripe, 1).fillRect(-1, -5, 2, 12);
  g.fillStyle(outline, 1).fillRect(-5, 8, 2, 1).fillRect(3, 8, 2, 1);
  if (look.sticker !== undefined) g.fillStyle(look.sticker, 1).fillRect(-4, 1, 3, 3);
  if (look.tag !== undefined) {
    g.fillStyle(look.tag, 1);
    if (look.tagAt === 'handle') g.fillRect(-2, -8, 4, 2);
    else g.fillRect(2, -1, 2, 4);
  }
}
