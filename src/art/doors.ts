import Phaser from 'phaser';
import { PAL } from './palette';

export interface DoorStyle {
  panel: string;
  edge: string;
  window: string;
  /** Franja inferior opcional (ej. aviso amarillo del metro). */
  stripe?: string;
}

export const DOOR_STYLES = {
  /** Puertas vistas desde dentro del vagón L1. */
  vagon: { panel: PAL.trainWall, edge: PAL.metroRed, window: PAL.tunnel, stripe: PAL.yellow },
  /** Puertas vistas desde dentro de la micro. */
  micro: { panel: PAL.metal, edge: PAL.red, window: PAL.sky },
  /** Puertas exteriores del tren (andén). */
  tren: { panel: PAL.metroRed, edge: PAL.metroRedDark, window: PAL.tunnel },
  /** Puertas exteriores del tren EFE (andén). */
  tren_efe: { panel: '#f4f5f7', edge: '#d8232a', window: '#1e2128' },
  /** Puertas del tren EFE vistas desde dentro. */
  tren_efe_in: { panel: '#e8eaee', edge: '#9aa0aa', window: '#9cd0f0', stripe: '#d8232a' },
  /** Puerta exterior de la micro (paradero). */
  bus: { panel: '#d8dce0', edge: PAL.outline, window: PAL.glass },
} satisfies Record<string, DoorStyle>;

export type DoorStyleId = keyof typeof DOOR_STYLES;

const hex = (c: string): number => Phaser.Display.Color.HexStringToColor(c).color;

function drawHalf(g: Phaser.GameObjects.Graphics, w: number, h: number, s: DoorStyle, side: 'left' | 'right'): void {
  g.fillStyle(hex(s.edge), 1).fillRect(0, 0, w, h);
  const inner = side === 'left' ? 1 : 0;
  g.fillStyle(hex(s.panel), 1).fillRect(inner, 1, w - 1, h - 2);
  const winW = Math.max(1, Math.floor(w / 2));
  g.fillStyle(hex(s.window), 1).fillRect(side === 'left' ? 1 + Math.floor((w - 1 - winW) / 2) : Math.floor((w - 1 - winW) / 2), 2, winW, Math.max(2, Math.floor(h * 0.45)));
  if (s.stripe) g.fillStyle(hex(s.stripe), 1).fillRect(inner, h - 4, w - 1, 2);
}

/**
 * Puerta corrediza de dos hojas dibujada con Graphics. Cerrada tapa el rectángulo (x, y, w, h);
 * al abrir cada hoja se desliza hacia afuera dejando ver lo que hay detrás (el tile o la textura).
 */
export class SlidingDoor {
  readonly left: Phaser.GameObjects.Graphics;
  readonly right: Phaser.GameObjects.Graphics;
  private readonly half: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    w: number,
    h: number,
    style: DoorStyleId,
    open = false,
  ) {
    this.half = Math.floor(w / 2);
    const s = DOOR_STYLES[style];
    this.left = scene.add.graphics();
    drawHalf(this.left, this.half, h, s, 'left');
    this.right = scene.add.graphics();
    drawHalf(this.right, w - this.half, h, s, 'right');
    this.place(open ? 1 : 0);
  }

  get parts(): Phaser.GameObjects.Graphics[] {
    return [this.left, this.right];
  }

  setDepth(depth: number): this {
    this.left.setDepth(depth);
    this.right.setDepth(depth);
    return this;
  }

  /** Abre o cierra con animación. */
  set(open: boolean, ms = 380): Promise<void> {
    const state = { t: open ? 0 : 1 };
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: state,
        t: open ? 1 : 0,
        duration: ms,
        ease: open ? 'Cubic.Out' : 'Cubic.In',
        onUpdate: () => this.place(state.t),
        onComplete: () => resolve(),
      });
    });
  }

  private place(t: number): void {
    const shift = Math.round((this.half - 1) * t);
    this.left.setPosition(this.x - shift, this.y);
    this.right.setPosition(this.x + this.half + shift, this.y);
  }
}
