import Phaser from 'phaser';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import type { RideProgress } from '../types/mission';
import { METRO_L1 } from './LineMapOverlay';
import { makeText } from './theme';

/** Bajo el vagón (franja libre entre el mapa y el borde); la caja de diálogo lo tapa mientras está abierta. */
const PANEL = { x: 38, y: 134, w: BASE_WIDTH - 76, h: 30 };
const LED = '#ffb43c';
const LIT = 0xffd060;
const RED = 0xd8232a;
/** Mínimo de estaciones visibles en el letrero (se completa hacia el sentido del viaje). */
const MIN_WINDOW = 7;
const BLINK_MS = 320;

interface LineStation {
  name: string;
  transfer?: { color: string };
}

/**
 * Letrero LED del vagón (metro y tren): muestra el tramo de la línea del viaje y prende la luz
 * de la estación actual (parpadea mientras se acerca, fija al detenerse). Escucha 'ride-progress'.
 * Si todas las paradas son de la Línea 1 usa sus estaciones; si no (tren), las del propio viaje.
 */
export class RideDisplay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly status: Phaser.GameObjects.Text;
  private readonly doors: Phaser.GameObjects.Text;
  private readonly dots: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly accent: Phaser.GameObjects.Graphics;
  private stations: LineStation[] = [];
  private color = RED;
  private window: number[] = [];
  private current = -1;
  private here = -1;
  private moving = false;
  private blink = 0;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.18).fillRoundedRect(PANEL.x, PANEL.y + 2, PANEL.w, PANEL.h, 5);
    bg.fillStyle(0x2a2433, 1).fillRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 5);
    bg.fillStyle(0x120e16, 1).fillRoundedRect(PANEL.x + 2, PANEL.y + 2, PANEL.w - 4, PANEL.h - 4, 4);
    this.accent = scene.add.graphics();
    this.status = makeText(scene, PANEL.x + 12, PANEL.y + 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: LED });
    this.doors = makeText(scene, PANEL.x + PANEL.w - 8, PANEL.y + 4, '', { fontSize: '8px', color: '#9a8fa8' }).setOrigin(1, 0);
    this.dots = scene.add.graphics();
    this.glow = scene.add.graphics();
    this.root = scene.add
      .container(0, 0, [bg, this.accent, this.dots, this.glow, this.status, this.doors])
      .setDepth(45)
      .setAlpha(0)
      .setVisible(false);
    EventSystem.onScene(scene, 'ride-progress', (p) => this.onProgress(p));
  }

  update(delta: number): void {
    if (!this.visible || !this.moving) return;
    this.blink += delta;
    this.glow.setVisible(Math.floor(this.blink / BLINK_MS) % 2 === 0);
  }

  private onProgress(p: RideProgress): void {
    if (p.type !== 'metro' || p.state === 'end' || p.stops.length === 0) {
      this.hide();
      return;
    }
    const l1 = METRO_L1.stations.map((s) => s.name);
    const origin = p.origin ?? METRO_L1.here;
    const onL1 = [origin, ...p.stops].every((s) => l1.includes(s));
    this.stations = onL1 ? METRO_L1.stations : [origin, ...p.stops].map((name) => ({ name }));
    this.color = p.color ? Phaser.Display.Color.HexStringToColor(p.color).color : RED;
    this.accent.clear().fillStyle(this.color, 1).fillRect(PANEL.x + 6, PANEL.y + 3, 2, 10);
    const names = this.stations.map((s) => s.name);
    const target = names.indexOf(p.stops[p.index]);
    if (target < 0) {
      this.hide();
      return;
    }
    const first = names.indexOf(p.stops[0]);
    this.here = names.indexOf(origin);
    const dir = first >= this.here ? 1 : -1;
    const last = names.indexOf(p.stops[p.stops.length - 1]);
    let from = Math.min(this.here, last);
    let to = Math.max(this.here, last + dir);
    while (to - from + 1 < MIN_WINDOW) {
      if (dir > 0 && to < names.length - 1) to++;
      else if (dir < 0 && from > 0) from--;
      else break;
    }
    from = Math.max(0, from);
    to = Math.min(names.length - 1, to);
    this.window = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    this.current = target;
    this.moving = p.state === 'moving';
    this.blink = 0;

    const name = names[target].toUpperCase();
    this.status.setText(this.moving ? `PRÓXIMA: ${name}` : `ESTACIÓN ${name}`);
    this.doors.setText(this.moving ? 'En marcha' : 'Puertas abiertas').setColor(this.moving ? '#9a8fa8' : '#7fd88a');
    this.draw(dir);
    this.show();
  }

  private draw(dir: number): void {
    const n = this.window.length;
    const x0 = PANEL.x + 14;
    const x1 = PANEL.x + PANEL.w - 14;
    const y = PANEL.y + 21;
    const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
    const g = this.dots.clear();
    const dim = Phaser.Display.Color.IntegerToColor(this.color).darken(55).color;
    g.fillStyle(this.color, 1).fillRect(x0, y - 1, x1 - x0, 2);
    this.glow.clear();
    this.window.forEach((station, i) => {
      const x = Math.round(x0 + i * step);
      const passed = (station - this.here) * dir < (this.current - this.here) * dir;
      const st = this.stations[station];
      if (station === this.current) {
        this.glow.fillStyle(LIT, 0.35).fillCircle(x, y, 6).fillStyle(LIT, 1).fillCircle(x, y, 3.5);
        g.fillStyle(dim, 1).fillCircle(x, y, 3.5);
      } else if (passed) {
        g.fillStyle(dim, 1).fillCircle(x, y, 3).fillStyle(0x1a1418, 1).fillCircle(x, y, 1.5);
      } else {
        const ring = st.transfer ? Phaser.Display.Color.HexStringToColor(st.transfer.color).color : this.color;
        g.fillStyle(ring, 1).fillCircle(x, y, 3).fillStyle(0xffffff, 1).fillCircle(x, y, 1.8);
      }
    });
    this.glow.setVisible(true);
  }

  private show(): void {
    if (this.visible) return;
    this.visible = true;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(true);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 200 });
  }

  private hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 200,
      onComplete: () => this.root.setVisible(false),
    });
  }
}
