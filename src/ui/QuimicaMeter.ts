import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { EventSystem } from '../systems/EventSystem';
import { StoryState } from '../systems/StoryState';
import { makeText } from './theme';

/**
 * Misión 6: el medidor de «química» con Sira, debajo del HUD de la izquierda. Cada flag `m6_q_<algo>`
 * (una buena respuesta, un detalle, un gesto) suma medio corazón; se ve desde que la conoces en la piscina
 * (flag `m6_quimica_visible`). Al subir, el corazón late.
 *
 * Misión 7: el mismo medidor, con sus propias flags (`m7_q_<algo>`, visible con `m7_quimica_visible`).
 * Misión 8: con Laura, en la plaza (`m8_q_<algo>`, visible con `m8_quimica_visible`).
 * Misión 9: con Laura otra vez, en el taxi y en la fiesta (`m9_q_<algo>`, visible con `m9_quimica_visible`).
 */

export const QUIMICA_PREFIX = 'm6_q_';
export const QUIMICA_MAX = 14;
/** Prefijo de las flags de química y flag que muestra el medidor, por misión. */
const BY_MISSION: Record<string, { prefix: string; visible: string }> = {
  mission06: { prefix: QUIMICA_PREFIX, visible: 'm6_quimica_visible' },
  mission07: { prefix: 'm7_q_', visible: 'm7_quimica_visible' },
  mission08: { prefix: 'm8_q_', visible: 'm8_quimica_visible' },
  mission09: { prefix: 'm9_q_', visible: 'm9_quimica_visible' },
};
const HEARTS = QUIMICA_MAX / 2;
const X = 4;
const Y = 35;
const DEPTH = 41;

/** Cuántos puntos de química llevas en la misión en curso (flags `m6_q_*` o `m7_q_*`). */
export function quimica(): number {
  const prefix = BY_MISSION[StoryState.missionId]?.prefix ?? QUIMICA_PREFIX;
  return StoryState.allFlags().filter((f) => f.startsWith(prefix)).length;
}

export class QuimicaMeter {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private value = -1;
  private pulse = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH);
    this.label = makeText(scene, X + 4, Y + 2, 'Química', { fontSize: '7px', color: '#ffd6e2' }).setDepth(DEPTH + 1);
    this.refresh(true);
    EventSystem.onScene(scene, 'state-changed', () => this.refresh(false));
  }

  private refresh(first: boolean): void {
    const def = BY_MISSION[StoryState.missionId];
    const visible = def !== undefined && StoryState.hasFlag(def.visible);
    this.g.setVisible(visible);
    this.label.setVisible(visible);
    if (!visible) return;
    const v = Math.min(QUIMICA_MAX, quimica());
    if (v === this.value) return;
    if (!first && this.value >= 0 && v > this.value) {
      this.pulse = 1;
      playSfx('latido');
      this.floatHeart();
    }
    this.value = v;
    this.draw();
  }

  update(delta: number): void {
    if (this.pulse <= 0) return;
    this.pulse = Math.max(0, this.pulse - delta / 600);
    this.draw();
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    const w = 40 + HEARTS * 8;
    g.fillStyle(0x2a1824, 0.85).fillRoundedRect(X, Y, w, 12, 3);
    g.lineStyle(1, 0xe8607a, 0.8).strokeRoundedRect(X, Y, w, 12, 3);
    const full = Math.floor(this.value / 2);
    const half = this.value % 2 === 1;
    for (let i = 0; i < HEARTS; i++) {
      const hx = X + 38 + i * 8;
      const hy = Y + 3;
      const beat = i === Math.max(0, Math.ceil(this.value / 2) - 1) && this.pulse > 0 ? Math.round(this.pulse * 1.5) : 0;
      const color = i < full ? 0xf05a7a : i === full && half ? 0xf0a0b4 : 0x5a3848;
      this.heart(hx - beat, hy - beat, color, 1 + (beat > 0 ? 0.3 : 0));
    }
  }

  private heart(x: number, y: number, color: number, s: number): void {
    const r = (dx: number, dy: number, w: number, h: number): void => {
      this.g.fillStyle(color, 1).fillRect(Math.round(x + dx * s), Math.round(y + dy * s), Math.ceil(w * s), Math.ceil(h * s));
    };
    r(0, 0, 2, 1);
    r(3, 0, 2, 1);
    r(0, 1, 5, 2);
    r(1, 3, 3, 1);
    r(2, 4, 1, 1);
  }

  private floatHeart(): void {
    const t = makeText(this.scene, X + 38 + Math.ceil(this.value / 2) * 8, Y + 14, '+♥', { fontSize: '8px', fontStyle: '600', color: '#ff8aa8', stroke: '#2a1824', strokeThickness: 2 })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH + 2);
    this.scene.tweens.add({ targets: t, y: t.y + 10, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }
}
