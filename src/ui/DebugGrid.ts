import Phaser from 'phaser';
import { TILE } from '../config/display';
import type { GameMap } from '../systems/GameMap';
import { makeText } from './theme';

const DEPTH = 900;
/** Cada cuántos tiles se marca la coordenada. */
const MARK = 5;

/**
 * Cuadrícula de depuración del modo admin (F4, segundo nivel), dibujada sobre el mapa: tiles sólidos en rojo,
 * warps en verde, puntos de aparición en azul, triggers en magenta, zonas en amarillo y el tile bajo el cursor.
 * Solo dibuja lo que se ve en cámara.
 */
export class DebugGrid {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private used = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH);
  }

  destroy(): void {
    this.g.destroy();
    for (const t of this.labels) t.destroy();
    this.labels.length = 0;
  }

  draw(map: GameMap): void {
    const { g } = this;
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    const x0 = Math.max(0, Math.floor(v.x / TILE));
    const y0 = Math.max(0, Math.floor(v.y / TILE));
    const x1 = Math.min(map.width - 1, Math.ceil((v.x + v.width) / TILE));
    const y1 = Math.min(map.height - 1, Math.ceil((v.y + v.height) / TILE));
    this.used = 0;
    g.clear();

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (map.isSolid(x, y)) g.fillStyle(0xff3b3b, 0.26).fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    for (let x = x0; x <= x1 + 1; x++) {
      g.lineStyle(1, 0xffffff, x % MARK === 0 ? 0.4 : 0.16).lineBetween(x * TILE, y0 * TILE, x * TILE, (y1 + 1) * TILE);
    }
    for (let y = y0; y <= y1 + 1; y++) {
      g.lineStyle(1, 0xffffff, y % MARK === 0 ? 0.4 : 0.16).lineBetween(x0 * TILE, y * TILE, (x1 + 1) * TILE, y * TILE);
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x % MARK === 0 && y % MARK === 0) this.label(`${x},${y}`, x * TILE + 1, y * TILE + 1, '#cfd8f0');
      }
    }

    for (const z of map.data.zones ?? []) {
      g.lineStyle(1, 0xffd45a, 0.7).strokeRect(z.x * TILE + 0.5, z.y * TILE + 0.5, z.w * TILE - 1, z.h * TILE - 1);
      this.label(z.name, z.x * TILE + 2, z.y * TILE + TILE - 8, '#ffd45a');
    }
    for (const t of map.data.triggers ?? []) {
      g.lineStyle(1, 0xff5bd8, 0.8).strokeRect(t.x * TILE + 0.5, t.y * TILE + 0.5, t.w * TILE - 1, t.h * TILE - 1);
      this.label(`!${t.id}`, t.x * TILE + 2, t.y * TILE + 2, '#ff8be6');
    }
    for (const w of map.data.warps ?? []) {
      g.fillStyle(0x3bff7a, 0.45).fillRect(w.x * TILE, w.y * TILE, TILE, TILE);
      this.label(`>${w.to}`, w.x * TILE + 1, w.y * TILE + 5, '#b6ffcf');
    }
    for (const [name, s] of Object.entries(map.data.spawns)) {
      g.fillStyle(0x4aa8ff, 0.5).fillRect(s.x * TILE + 3, s.y * TILE + 3, TILE - 6, TILE - 6);
      this.label(name, s.x * TILE + 1, s.y * TILE + 8, '#bfe0ff');
    }

    // Tile bajo el cursor.
    const ptr = this.scene.input.activePointer;
    const p = cam.getWorldPoint(ptr.x, ptr.y);
    const hx = Math.floor(p.x / TILE);
    const hy = Math.floor(p.y / TILE);
    if (map.inBounds(hx, hy)) g.lineStyle(1, 0xffff55, 1).strokeRect(hx * TILE + 0.5, hy * TILE + 0.5, TILE - 1, TILE - 1);

    for (let i = this.used; i < this.labels.length; i++) this.labels[i].setVisible(false);
  }

  /** Reusa textos de un pozo: a cada cuadro se asignan los que hagan falta. */
  private label(text: string, x: number, y: number, color: string): void {
    let t = this.labels[this.used];
    if (!t) {
      t = makeText(this.scene, 0, 0, '', { fontSize: '6px', color }).setDepth(DEPTH + 1);
      t.setStroke('#0a0e18', 2);
      this.labels.push(t);
    }
    this.used++;
    t.setText(text).setColor(color).setPosition(x, y).setVisible(true);
  }
}
