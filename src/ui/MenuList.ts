import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { Controls } from '../systems/Controls';
import { drawPanel, drawTriangle, makeText, MEDAL_CSS, THEME } from './theme';

export interface MenuItem {
  label: string;
  action: () => void;
  /** Se ve en gris y no hace nada al elegirla (ej. una misión bloqueada). */
  disabled?: boolean;
  /** Ícono dorado que titila a la derecha del texto, para destacar la opción (ej. "★"). */
  badge?: string;
}

export interface MenuOptions {
  /** Centro horizontal del panel. */
  x: number;
  /** Borde superior del panel. */
  y: number;
  horizontal?: boolean;
  minWidth?: number;
  /** Sin panel de fondo (ej. dentro de otro panel). */
  bare?: boolean;
  fontSize?: string;
  depth?: number;
  /** Alto de cada fila (vertical). Por defecto 13. */
  rowHeight?: number;
}

const ROW = 13;
const PAD_Y = 5;
const CURSOR_GAP = 12;
const H_GAP = 26;
const BADGE_GAP = 4;

/** Lista de opciones con cursor triangular (W/S o A/D para moverse, E para elegir). */
export class MenuList {
  readonly container: Phaser.GameObjects.Container;
  /** Tamaño del panel. */
  readonly width: number;
  readonly height: number;
  private readonly texts: Phaser.GameObjects.Text[];
  private readonly badges: (Phaser.GameObjects.Text | null)[];
  private readonly cursor: Phaser.GameObjects.Graphics;
  private selected = 0;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    private readonly items: MenuItem[],
    private readonly opts: MenuOptions,
  ) {
    this.texts = items.map((item) =>
      makeText(scene, 0, 0, item.label, { color: THEME.ink, fontSize: opts.fontSize ?? '10px' }),
    );
    this.badges = items.map((item) =>
      item.badge ? makeText(scene, 0, 0, item.badge, { color: MEDAL_CSS[0], fontSize: opts.fontSize ?? '10px' }).setOrigin(0.5) : null,
    );
    /** Lo que ocupa cada opción contando su ícono. */
    const span = (i: number): number => this.texts[i].width + (this.badges[i] ? BADGE_GAP + this.badges[i].width : 0);
    this.cursor = scene.add.graphics();
    drawTriangle(this.cursor, 'right', THEME.accent, 3);

    let w: number;
    let h: number;
    if (opts.horizontal) {
      let x = CURSOR_GAP;
      this.texts.forEach((t, i) => {
        t.setPosition(x, PAD_Y);
        x += Math.ceil(span(i)) + H_GAP;
      });
      w = x - H_GAP + 10;
      h = ROW + PAD_Y * 2 - 1;
    } else {
      const row = opts.rowHeight ?? ROW;
      this.texts.forEach((t, i) => t.setPosition(CURSOR_GAP + 4, PAD_Y + i * row));
      w = Math.ceil(Math.max(...this.texts.map((_, i) => span(i)))) + CURSOR_GAP + 14;
      h = items.length * row + PAD_Y * 2 - 1;
    }
    w = Math.max(w, opts.minWidth ?? 0);
    this.width = w;
    this.height = h;

    const parts: Phaser.GameObjects.GameObject[] = [];
    if (!opts.bare) {
      const bg = scene.add.graphics();
      drawPanel(bg, 0, 0, w, h, { radius: 5 });
      parts.push(bg);
    }
    const badges = this.badges.filter((b): b is Phaser.GameObjects.Text => b !== null);
    this.badges.forEach((b, i) => {
      const t = this.texts[i];
      b?.setPosition(Math.round(t.x + t.width + BADGE_GAP + b.width / 2), Math.round(t.y + t.height / 2));
    });
    this.container = scene.add.container(Math.round(opts.x - w / 2), opts.y, [...parts, ...this.texts, ...badges, this.cursor]);
    if (badges.length > 0) {
      scene.tweens.add({ targets: badges, scale: 1.25, alpha: 0.75, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    this.container.setDepth(opts.depth ?? 20);
    this.select(0);
  }

  /** Procesa la entrada. Llamar en update() de la escena. */
  update(): void {
    if (!this.enabled) return;
    const n = this.items.length;
    const prev = this.opts.horizontal ? Controls.consume('left') || Controls.consume('up') : Controls.consume('up');
    const next = this.opts.horizontal ? Controls.consume('right') || Controls.consume('down') : Controls.consume('down');
    if (prev || next) playSfx('cursor');
    if (prev) this.select((this.selected + n - 1) % n);
    if (next) this.select((this.selected + 1) % n);
    if (Controls.consume('interact')) {
      const item = this.items[this.selected];
      if (item.disabled) {
        playSfx('error');
        return;
      }
      playSfx(/^(no|volver|cancelar)$/i.test(item.label) ? 'cancel' : 'select');
      item.action();
    }
  }

  destroy(): void {
    this.container.destroy();
  }

  private select(i: number): void {
    this.selected = i;
    const t = this.texts[i];
    this.cursor.setPosition(t.x - 7, t.y + t.height / 2);
    this.texts.forEach((txt, idx) =>
      txt.setColor(this.items[idx].disabled ? THEME.inkMuted : idx === i ? THEME.accentCss : THEME.ink),
    );
  }
}
