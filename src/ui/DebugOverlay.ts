import Phaser from 'phaser';
import { FONT_TEXT } from '../config/display';
import type { MapScene } from '../scenes/MapScene';
import { Admin } from '../systems/Admin';
import { clockMinutes, formatClock, currentMission } from '../systems/Mission';
import { formatMoney, StoryState } from '../systems/StoryState';
import { makeText } from './theme';

const DEPTH = 160;
const X = 3;
const Y = 38;
const REFRESH_MS = 120;
const ARROWS: Record<string, string> = { up: '^', down: 'v', left: '<', right: '>' };

/**
 * Panel de depuración del modo admin (F4): mapa, coordenadas del jugador y del cursor (tile y píxel), qué hay
 * en el tile bajo el cursor, zona, misión, reloj, flags y FPS. Un clic copia "mapa x,y" al portapapeles, para
 * pegarlo en un JSON de mapa. Con F4 otra vez se suma la cuadrícula sobre el mapa (DebugGrid).
 */
export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly toast: Phaser.GameObjects.Text;
  private since = REFRESH_MS;
  /** Último tile bajo el cursor (el clic copia ese). */
  private last: { map: string; x: number; y: number } | null = null;
  private toastMs = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.bg = scene.add.rectangle(X - 2, Y - 2, 10, 10, 0x070a14, 0.78).setOrigin(0, 0).setDepth(DEPTH).setVisible(false);
    this.text = makeText(scene, X, Y, '', { fontFamily: FONT_TEXT, fontSize: '8px', color: '#d8f0d0', lineSpacing: 0 }).setDepth(DEPTH + 1).setVisible(false);
    this.toast = makeText(scene, X, Y, '', { fontSize: '8px', color: '#ffd45a', backgroundColor: '#070a14', padding: { x: 2, y: 1 } })
      .setDepth(DEPTH + 2)
      .setVisible(false);
    scene.input.on('pointerdown', () => this.copyCursor());
  }

  get visible(): boolean {
    return Admin.debugMode > 0;
  }

  update(delta: number, map: MapScene | undefined): void {
    if (!this.visible) {
      this.bg.setVisible(false);
      this.text.setVisible(false);
      this.toast.setVisible(false);
      return;
    }
    if (this.toastMs > 0) {
      this.toastMs -= delta;
      if (this.toastMs <= 0) this.toast.setVisible(false);
    }
    this.since += delta;
    if (this.since < REFRESH_MS && this.text.visible) return;
    this.since = 0;
    this.text.setText(this.lines(map).join('\n')).setVisible(true);
    this.bg.setSize(this.text.width + 6, this.text.height + 4).setVisible(true);
    this.toast.setPosition(X, Y + this.text.height + 6);
  }

  private lines(map: MapScene | undefined): string[] {
    const game = this.scene.game;
    const scenes = game.scene.getScenes(true).map((s) => s.scene.key).join(',');
    const out: string[] = [];
    this.last = null;
    if (map?.sys.isActive()) {
      const i = map.debugInfo;
      out.push(`MAPA   ${i.id} (${i.kind}) ${i.width}x${i.height}`);
      out.push(`JUGADOR tile ${i.x},${i.y}  px ${i.px},${i.py}  ${ARROWS[i.facing] ?? i.facing}`);
      const ptr = this.scene.input.activePointer;
      const c = map.inspectAt(ptr.x, ptr.y);
      this.last = { map: i.id, x: c.x, y: c.y };
      out.push(`CURSOR tile ${c.x},${c.y}  (clic: copiar)`);
      out.push(`       ${c.text}`);
      out.push(`ZONA   ${i.zone}`);
    } else {
      out.push('Sin mapa activo (título, minijuego o menú)');
    }
    const m = currentMission();
    out.push(`MISIÓN ${m.id} · ${formatClock(clockMinutes())} · ${formatMoney(StoryState.money)}`);
    out.push(`FLAGS  ${StoryState.allFlags().length}  ·  ESCENAS ${scenes}`);
    out.push(`FPS    ${Math.round(game.loop.actualFps)}  ·  F4: ${Admin.debugMode === 2 ? 'cuadrícula' : 'panel'}`);
    return out;
  }

  private copyCursor(): void {
    if (!this.visible || !this.last) return;
    const { map, x, y } = this.last;
    const value = `${map} ${x},${y}`;
    try {
      void navigator.clipboard?.writeText(value);
    } catch {
      // Sin portapapeles (contexto no seguro): el aviso igual muestra las coordenadas.
    }
    this.toast.setText(`Copiado: ${value}`).setVisible(true);
    this.toastMs = 1800;
  }
}
