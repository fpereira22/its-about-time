import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { Controls } from '../systems/Controls';
import { drawPanel, drawTriangle, makeText, THEME } from './theme';

export interface MenuItem {
  label: string;
  action: () => void;
  /** Se ve en gris y no hace nada al elegirla (ej. una misión bloqueada). */
  disabled?: boolean;
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
}

const ROW = 13;
const PAD_Y = 5;
const CURSOR_GAP = 12;
const H_GAP = 26;

/** Lista de opciones con cursor triangular (W/S o A/D para moverse, E para elegir). */
export class MenuList {
  readonly container: Phaser.GameObjects.Container;
  private readonly texts: Phaser.GameObjects.Text[];
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
    this.cursor = scene.add.graphics();
    drawTriangle(this.cursor, 'right', THEME.accent, 3);

    let w: number;
    let h: number;
    if (opts.horizontal) {
      let x = CURSOR_GAP;
      this.texts.forEach((t) => {
        t.setPosition(x, PAD_Y);
        x += Math.ceil(t.width) + H_GAP;
      });
      w = x - H_GAP + 10;
      h = ROW + PAD_Y * 2 - 1;
    } else {
      this.texts.forEach((t, i) => t.setPosition(CURSOR_GAP + 4, PAD_Y + i * ROW));
      w = Math.ceil(Math.max(...this.texts.map((t) => t.width))) + CURSOR_GAP + 14;
      h = items.length * ROW + PAD_Y * 2 - 1;
    }
    w = Math.max(w, opts.minWidth ?? 0);

    const parts: Phaser.GameObjects.GameObject[] = [];
    if (!opts.bare) {
      const bg = scene.add.graphics();
      drawPanel(bg, 0, 0, w, h, { radius: 5 });
      parts.push(bg);
    }
    this.container = scene.add.container(Math.round(opts.x - w / 2), opts.y, [...parts, ...this.texts, this.cursor]);
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
