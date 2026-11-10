import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { Settings, TEXT_SPEEDS, VOLUME_STEPS } from '../systems/Settings';
import { TouchControls } from '../systems/TouchControls';
import { drawPanel, drawTriangle, makeText, THEME } from './theme';

/** Una fila del menú: volumen (barra), opción (texto que se cambia con A/D) o acción (Volver). */
interface Row {
  label: string;
  kind: 'volume' | 'choice' | 'action';
  /** Volumen 0..VOLUME_STEPS o texto de la opción. */
  value?: () => number | string;
  /** A/D (-1 / +1) y E (+1). */
  change: (dir: 1 | -1) => void;
}

const W = 216;
const ROW = 15;
const HEAD = 24;
const FOOT = 18;
const SEGMENT = 6;
/** Centro horizontal de la columna de valores, desde el borde izquierdo del panel. */
const VALUE_CX = 150;
const ARROW_GAP = 42;

/**
 * Menú de ajustes (título y pausa): volumen de música y efectos, silencio, velocidad del texto y
 * controles táctiles. Los cambios se aplican y guardan al instante (src/systems/Settings.ts).
 * W/S: fila · A/D: cambiar · E: cambiar o volver · Esc: volver.
 */
export class SettingsPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly rows: Row[];
  private selected = 0;
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: { depth: number; onClose: () => void },
  ) {
    this.rows = this.buildRows();
    this.root = scene.add.container(0, 0).setDepth(opts.depth);
    this.render();
    this.root.setAlpha(0).setY(4);
    scene.tweens.add({ targets: this.root, alpha: 1, y: 0, duration: 120, ease: 'Cubic.Out' });
  }

  update(): void {
    if (this.closed) return;
    if (Controls.consume('menu')) return this.close();
    const n = this.rows.length;
    if (Controls.consume('up')) this.move((this.selected + n - 1) % n);
    if (Controls.consume('down')) this.move((this.selected + 1) % n);
    const row = this.rows[this.selected];
    const left = Controls.consume('left');
    const right = Controls.consume('right');
    if (row.kind !== 'action' && (left || right)) this.apply(row, right ? 1 : -1);
    if (Controls.consume('interact')) {
      if (row.kind === 'action') return this.close();
      this.apply(row, 1);
    }
  }

  destroy(): void {
    this.closed = true;
    this.root.destroy();
  }

  private close(): void {
    playSfx('cancel');
    this.destroy();
    this.opts.onClose();
  }

  private move(i: number): void {
    playSfx('cursor');
    this.selected = i;
    this.render();
  }

  private apply(row: Row, dir: 1 | -1): void {
    const before = row.value?.();
    row.change(dir);
    const after = row.value?.();
    // Los efectos suenan después del cambio: así se escucha el volumen nuevo.
    playSfx(before === after ? 'error' : 'cursor');
    this.render();
  }

  private buildRows(): Row[] {
    const volume = (key: 'music' | 'sfx') => (dir: 1 | -1) => Settings.set(key, Settings.get(key) + dir);
    const rows: Row[] = [
      { label: 'Música', kind: 'volume', value: () => Settings.get('music'), change: volume('music') },
      { label: 'Efectos', kind: 'volume', value: () => Settings.get('sfx'), change: volume('sfx') },
      {
        label: 'Sonido',
        kind: 'choice',
        value: () => (Settings.get('muted') ? 'Silenciado' : 'Activado'),
        change: () => Settings.set('muted', !Settings.get('muted')),
      },
      {
        label: 'Texto',
        kind: 'choice',
        value: () => Settings.textSpeedName(),
        change: (dir) => {
          const i = TEXT_SPEEDS.indexOf(Settings.get('textSpeed'));
          Settings.set('textSpeed', TEXT_SPEEDS[(i + dir + TEXT_SPEEDS.length) % TEXT_SPEEDS.length]);
        },
      },
      {
        // Solo Auto / Siempre: "Nunca" en un celular dejaría al jugador sin forma de moverse.
        // (El modo admin conserva las tres opciones.)
        label: 'Controles táctiles',
        kind: 'choice',
        value: () => (TouchControls.currentMode === 'on' ? 'Siempre' : TouchControls.currentMode === 'off' ? 'Nunca' : 'Auto'),
        change: () => TouchControls.setMode(TouchControls.currentMode === 'on' ? 'auto' : 'on'),
      },
      { label: 'Volver', kind: 'action', change: () => undefined },
    ];
    return rows;
  }

  private render(): void {
    this.root.removeAll(true);
    const h = HEAD + this.rows.length * ROW + FOOT;
    const x = Math.round((BASE_WIDTH - W) / 2);
    const y = Math.round((BASE_HEIGHT - h) / 2);
    const g = this.scene.add.graphics();
    drawPanel(g, x, y, W, h, { radius: 7 });
    this.root.add(g);
    this.root.add(makeText(this.scene, x + 12, y + 9, 'AJUSTES', { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.accentCss }));

    this.rows.forEach((row, i) => {
      const ry = y + HEAD + i * ROW;
      const active = i === this.selected;
      const color = active ? THEME.accentCss : THEME.ink;
      this.root.add(makeText(this.scene, x + 20, ry, row.label, { color }));
      if (active) {
        const cursor = this.scene.add.graphics();
        drawTriangle(cursor, 'right', THEME.accent, 3);
        cursor.setPosition(x + 12, ry + 6);
        this.root.add(cursor);
      }
      const cx = x + VALUE_CX;
      const value = row.value?.();
      if (typeof value === 'number') this.drawBar(cx, ry + 2, value, active);
      else if (value !== undefined) this.root.add(makeText(this.scene, cx, ry, value, { color }).setOrigin(0.5, 0));
      if (active && row.kind !== 'action') this.drawArrows(cx, ry + 6);
    });

    this.root.add(
      makeText(this.scene, x + W / 2, y + h - 6, 'A/D: cambiar · E: elegir · Esc: volver', {
        fontFamily: FONT_HUD,
        fontSize: '8px',
        color: THEME.inkMuted,
      }).setOrigin(0.5, 1),
    );
  }

  /** Barra de VOLUME_STEPS segmentos centrada en `cx`. */
  private drawBar(cx: number, y: number, value: number, active: boolean): void {
    const g = this.scene.add.graphics();
    const w = VOLUME_STEPS * SEGMENT;
    const x0 = Math.round(cx - w / 2);
    for (let i = 0; i < VOLUME_STEPS; i++) {
      const on = i < value;
      g.fillStyle(on ? (active ? THEME.accent : THEME.panelEdge) : THEME.panelInner, 1);
      g.fillRect(x0 + i * SEGMENT, y + (on ? 0 : 1), SEGMENT - 1, on ? 8 : 7);
    }
    this.root.add(g);
  }

  private drawArrows(cx: number, cy: number): void {
    const g = this.scene.add.graphics();
    g.fillStyle(THEME.accent, 1);
    const l = cx - ARROW_GAP;
    const r = cx + ARROW_GAP;
    g.fillTriangle(l + 2, cy - 3, l + 2, cy + 3, l - 2, cy);
    g.fillTriangle(r - 2, cy - 3, r - 2, cy + 3, r + 2, cy);
    this.root.add(g);
  }
}
