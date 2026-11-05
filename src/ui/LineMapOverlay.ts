import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { charKey } from '../art/SpriteRegistry';
import { frameIndex } from '../art/characters';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import lineData from '../data/metro_l1.json';
import type { MapScene } from '../scenes/MapScene';
import { Controls } from '../systems/Controls';
import { drawPanel, makeText, THEME } from './theme';

export interface MetroStation {
  name: string;
  transfer?: { line: string; color: string };
  comment: string;
}

export interface MetroLine {
  name: string;
  color: string;
  here: string;
  destination: string;
  stations: MetroStation[];
}

export const METRO_L1 = lineData as MetroLine;

const RED = 0xd8232a;
const RED_CSS = '#d8232a';
const LINE_Y = 114;
const X0 = 18;
const X1 = 258;
/** Inclinación de los nombres (más vertical = menos choques entre etiquetas vecinas). */
const LABEL_ANGLE = -60;
const FADE_MS = 140;
const HINT = 'Haz clic en una estación (o A/D + E). Esc: cerrar.';

interface StationView {
  dot: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
}

/**
 * Mapa de la Línea 1 a pantalla completa (muro de la estación).
 * Mouse: hover resalta, clic hace que el personaje comente la estación. Teclado: A/D + E, Esc/Tab cierra.
 */
export class LineMapOverlay {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;
  private views: StationView[] = [];
  private bubble: Phaser.GameObjects.Text | null = null;
  private map: MapScene | null = null;
  private active = false;
  private selected = 0;
  private hovered: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.overlay = scene.add
      .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x0a0e18, 1)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setVisible(false)
      .setDepth(210);
    this.root = scene.add.container(0, 0).setDepth(211);
  }

  get isOpen(): boolean {
    return this.active;
  }

  open(map: MapScene): void {
    this.map = map;
    this.active = true;
    this.hovered = null;
    this.selected = Math.max(0, METRO_L1.stations.findIndex((s) => s.name === METRO_L1.here));
    if (!this.scene.scene.isPaused(map.scene.key)) this.scene.scene.pause(map.scene.key);
    playSfx('open');
    this.scene.tweens.killTweensOf([this.overlay, this.root]);
    this.overlay.setVisible(true);
    this.scene.tweens.add({ targets: this.overlay, alpha: 0.55, duration: FADE_MS });
    this.build();
    this.root.setAlpha(0).setY(6);
    this.scene.tweens.add({ targets: this.root, alpha: 1, y: 0, duration: FADE_MS, ease: 'Cubic.Out' });
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    playSfx('close');
    this.root.removeAll(true);
    this.views = [];
    this.bubble = null;
    this.scene.input.manager.canvas.style.cursor = 'default';
    this.scene.tweens.killTweensOf(this.overlay);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => this.overlay.setVisible(false),
    });
    if (this.map) this.scene.scene.resume(this.map.scene.key);
    this.map = null;
  }

  update(_delta: number): void {
    if (!this.active) return;
    const n = METRO_L1.stations.length;
    if (Controls.consume('menu') || Controls.consume('inventory')) {
      this.close();
      return;
    }
    const left = Controls.consume('left') || Controls.consume('up');
    const right = Controls.consume('right') || Controls.consume('down');
    if (left || right) {
      this.selected = Phaser.Math.Clamp(this.selected + (right ? 1 : -1), 0, n - 1);
      this.hovered = null;
      playSfx('cursor');
      this.refresh();
    }
    if (Controls.consume('interact')) this.say(this.selected);
  }

  // ---------------------------------------------------------------------------

  private build(): void {
    const scene = this.scene;
    this.root.removeAll(true);
    this.views = [];
    const stations = METRO_L1.stations;
    const step = (X1 - X0) / (stations.length - 1);

    const panel = scene.add.graphics();
    drawPanel(panel, 6, 6, BASE_WIDTH - 12, BASE_HEIGHT - 12, { radius: 8 });
    const pill = scene.add.graphics().fillStyle(0xfbe3e4, 1).fillRoundedRect(14, 13, 58, 16, 5);
    const title = makeText(scene, 43, 21, METRO_L1.name.toUpperCase(), {
      fontFamily: FONT_HUD,
      fontSize: '8px',
      color: RED_CSS,
    }).setOrigin(0.5);
    const line = scene.add.graphics().fillStyle(RED, 1).fillRoundedRect(X0 - 4, LINE_Y - 2, X1 - X0 + 8, 4, 2);
    this.root.add([panel, pill, title, line]);

    stations.forEach((st, i) => {
      const x = Math.round(X0 + i * step);
      const dot = scene.add.container(x, LINE_Y, [this.drawDot(st)]);
      const label = makeText(scene, x + 1, LINE_Y - 7, st.name, { fontSize: '8px', color: THEME.ink })
        .setOrigin(0, 0.5)
        .setAngle(LABEL_ANGLE);
      const hit = scene.add.zone(x, LINE_Y - 10, step, 32).setInteractive({ useHandCursor: true });
      label.setInteractive({ useHandCursor: true });
      for (const target of [hit, label]) {
        target.on('pointerover', () => this.hover(i));
        target.on('pointerout', () => this.hover(null));
        target.on('pointerdown', () => this.say(i));
      }
      this.root.add([dot, label, hit]);
      if (st.transfer) {
        const chip = scene.add.graphics();
        chip.fillStyle(Phaser.Display.Color.HexStringToColor(st.transfer.color).color, 1).fillCircle(x, LINE_Y + 11, 4);
        const num = makeText(scene, x, LINE_Y + 11, st.transfer.line.replace('L', ''), {
          fontSize: '7px',
          fontStyle: '600',
          color: '#ffffff',
        }).setOrigin(0.5);
        this.root.add([chip, num]);
      }
      this.views.push({ dot, label });
    });

    this.addMarker(METRO_L1.here, 'Estás aquí', RED_CSS, step, 1);
    this.addMarker(METRO_L1.destination, 'Costanera ★', '#c88a10', step, 0);

    const bubbleBg = scene.add.graphics();
    drawPanel(bubbleBg, 14, 146, BASE_WIDTH - 28, 26, { radius: 6, fill: 0xffffff, edge: 0x2a2433, shadow: false });
    const face = scene.add.image(30, 159, charKey('player'), frameIndex('down', 0));
    this.bubble = makeText(scene, 44, 159, HINT, {
      fontSize: '9px',
      color: THEME.ink,
      wordWrap: { width: BASE_WIDTH - 72, useAdvancedWrap: true },
    }).setOrigin(0, 0.5);
    this.root.add([bubbleBg, face, this.bubble]);
    this.refresh();
  }

  private drawDot(st: MetroStation): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    const ring = st.transfer ? Phaser.Display.Color.HexStringToColor(st.transfer.color).color : RED;
    g.fillStyle(ring, 1).fillCircle(0, 0, 4);
    g.fillStyle(0xffffff, 1).fillCircle(0, 0, 2.5);
    return g;
  }

  /** Marcador bajo una estación; `align` 1 = texto hacia la izquierda, 0 = hacia la derecha. */
  private addMarker(name: string, text: string, color: string, step: number, align: 0 | 1): void {
    const i = METRO_L1.stations.findIndex((s) => s.name === name);
    if (i < 0) return;
    const x = Math.round(X0 + i * step);
    const pin = this.scene.add.graphics().fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
    pin.fillTriangle(x - 3, LINE_Y + 23, x + 3, LINE_Y + 23, x, LINE_Y + 18);
    const label = makeText(this.scene, x + (align ? 3 : -3), LINE_Y + 23, text, { fontSize: '8px', fontStyle: '600', color })
      .setOrigin(align, 0);
    this.root.add([pin, label]);
  }

  private hover(i: number | null): void {
    if (!this.active || i === this.hovered) return;
    this.hovered = i;
    if (i !== null) playSfx('cursor');
    this.refresh();
  }

  private say(i: number): void {
    const st = METRO_L1.stations[i];
    if (!st || !this.bubble) return;
    this.selected = i;
    playSfx('click');
    this.bubble.setText(st.comment);
    this.scene.tweens.killTweensOf(this.bubble);
    this.bubble.setAlpha(0.2);
    this.scene.tweens.add({ targets: this.bubble, alpha: 1, duration: 140 });
    this.refresh();
  }

  /** Resalta la estación bajo el mouse (o la elegida con teclado). */
  private refresh(): void {
    const focus = this.hovered ?? this.selected;
    this.views.forEach((v, i) => {
      const on = i === focus;
      v.dot.setScale(on ? 1.6 : 1);
      v.label.setColor(on ? RED_CSS : THEME.ink).setFontStyle(on ? '600' : '');
    });
  }
}
