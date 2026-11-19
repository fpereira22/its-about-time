import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { Chemistry, type Person } from '../systems/Chemistry';
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
 * Misión 10 (prefijo `m11_`): DOS medidores a la vez, uno con Laura (`m11_ql_*`) y otro con Sira (`m11_qs_*`), cada uno
 * con su nombre y su flag de visibilidad. Se apilan uno debajo del otro.
 */

export const QUIMICA_PREFIX = 'm6_q_';
export const QUIMICA_MAX = 14;

interface MeterDef {
  prefix: string;
  visible: string;
  /** Con quién es: al llenarse sube su nivel de química (ver systems/Chemistry.ts). */
  who: Person;
  /** Puntos con los que "se cubren todos los corazones" en esta misión (por defecto QUIMICA_MAX). */
  fullAt?: number;
  /** Texto del medidor (por defecto «Química»). */
  label?: string;
  /** Color del borde y de los corazones llenos. */
  color?: number;
}

/** Prefijo de las flags de química y flag que muestra el medidor, por misión (en orden de arriba abajo). */
const BY_MISSION: Record<string, MeterDef[]> = {
  mission06: [{ prefix: QUIMICA_PREFIX, visible: 'm6_quimica_visible', who: 'sira' }],
  mission07: [{ prefix: 'm7_q_', visible: 'm7_quimica_visible', who: 'sira' }],
  // En las misiones 8 y 9 hay menos jugadas que suman (13 y 17 en total, y algunas se excluyen): el tope baja.
  mission08: [{ prefix: 'm8_q_', visible: 'm8_quimica_visible', who: 'laura', fullAt: 10 }],
  mission09: [{ prefix: 'm9_q_', visible: 'm9_quimica_visible', who: 'laura', fullAt: 12 }],
  mission10: [
    { prefix: 'm11_ql_', visible: 'm11_quimica_laura', who: 'laura', label: 'Laura', color: 0xe8607a },
    { prefix: 'm11_qs_', visible: 'm11_quimica_sira', who: 'sira', label: 'Sira', color: 0x58b8c8 },
  ],
};
const HEARTS = QUIMICA_MAX / 2;
const X = 4;
const Y = 35;
const ROW = 14;
const DEPTH = 41;

/**
 * Cuántos puntos de química llevas en la misión en curso. Sin `prefix`, los del primer medidor de la misión
 * (en la misión 10: Laura); con `prefix` (ej. `m11_qs_`), los de ese.
 */
export function quimica(prefix?: string): number {
  const p = prefix ?? BY_MISSION[StoryState.missionId]?.[0]?.prefix ?? QUIMICA_PREFIX;
  return StoryState.allFlags().filter((f) => f.startsWith(p)).length;
}

class MeterBar {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private value = -1;
  private pulse = 0;
  private def: MeterDef | null = null;
  /** "Nv 2": el nivel de química, a la derecha de los corazones (solo desde el nivel 2). */
  private readonly badge: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly y: number,
  ) {
    this.g = scene.add.graphics().setDepth(DEPTH);
    this.label = makeText(scene, X + 4, y + 2, 'Química', { fontSize: '7px', color: '#ffd6e2' }).setDepth(DEPTH + 1);
    this.badge = makeText(scene, X + 40 + HEARTS * 8 + 3, y + 2, '', { fontSize: '7px', fontStyle: '600', color: '#ffe38a', stroke: '#2a1824', strokeThickness: 2 }).setDepth(DEPTH + 1);
  }

  refresh(def: MeterDef | undefined, first: boolean): void {
    if (def !== this.def) {
      this.def = def ?? null;
      this.value = -1;
      this.label.setText(def?.label ?? 'Química');
    }
    const visible = def !== undefined && StoryState.hasFlag(def.visible);
    this.g.setVisible(visible);
    this.label.setVisible(visible);
    this.badge.setVisible(false);
    if (!visible || !def) return;
    // Llenar los corazones sube el nivel de química con esa persona (una vez por misión).
    if (quimica(def.prefix) >= (def.fullAt ?? QUIMICA_MAX)) Chemistry.reachFull(def.who, StoryState.missionId, !first);
    const level = Chemistry.level(def.who);
    this.badge.setText(`Nv ${level}`).setVisible(level > 1);
    const v = Math.min(QUIMICA_MAX, quimica(def.prefix));
    if (v === this.value) return;
    if (!first && this.value >= 0 && v > this.value) {
      this.pulse = 1;
      playSfx('latido');
      this.floatHeart(v);
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
    const y = this.y;
    const color = this.def?.color ?? 0xe8607a;
    g.clear();
    const w = 40 + HEARTS * 8;
    g.fillStyle(0x2a1824, 0.85).fillRoundedRect(X, y, w, 12, 3);
    g.lineStyle(1, color, 0.8).strokeRoundedRect(X, y, w, 12, 3);
    const full = Math.floor(this.value / 2);
    const half = this.value % 2 === 1;
    const fullColor = this.def?.color === undefined ? 0xf05a7a : color;
    const halfColor = Phaser.Display.Color.IntegerToColor(fullColor).lighten(18).color;
    for (let i = 0; i < HEARTS; i++) {
      const hx = X + 38 + i * 8;
      const hy = y + 3;
      const beat = i === Math.max(0, Math.ceil(this.value / 2) - 1) && this.pulse > 0 ? Math.round(this.pulse * 1.5) : 0;
      const c = i < full ? fullColor : i === full && half ? halfColor : 0x5a3848;
      this.heart(hx - beat, hy - beat, c, 1 + (beat > 0 ? 0.3 : 0));
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

  private floatHeart(v: number): void {
    const t = makeText(this.scene, X + 38 + Math.ceil(v / 2) * 8, this.y + 14, '+♥', { fontSize: '8px', fontStyle: '600', color: '#ff8aa8', stroke: '#2a1824', strokeThickness: 2 })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH + 2);
    this.scene.tweens.add({ targets: t, y: t.y + 10, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }
}

export class QuimicaMeter {
  private readonly bars: MeterBar[];

  constructor(scene: Phaser.Scene) {
    const max = Math.max(...Object.values(BY_MISSION).map((d) => d.length));
    this.bars = Array.from({ length: max }, (_, i) => new MeterBar(scene, Y + i * ROW));
    Chemistry.syncFlags();
    this.refresh(true);
    EventSystem.onScene(scene, 'state-changed', () => this.refresh(false));
  }

  private refresh(first: boolean): void {
    const defs = BY_MISSION[StoryState.missionId] ?? [];
    // Cada medidor tiene su fila fija (en la misión 10: Laura arriba, Sira abajo).
    this.bars.forEach((bar, i) => bar.refresh(defs[i], first));
  }

  update(delta: number): void {
    for (const b of this.bars) b.update(delta);
  }
}
