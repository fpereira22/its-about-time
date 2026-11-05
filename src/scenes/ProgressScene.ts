import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { objKey } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { missionFullLabel, MISSIONS } from '../systems/Mission';
import { Records, type ProgressEntry } from '../systems/Records';
import { drawPanel, drawTriangle, fitText, makeText, THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

const PANEL = { x: 10, y: 4, w: BASE_WIDTH - 20, h: 160 };
const COL_W = (PANEL.w - 30) / 2;
const LEFT = PANEL.x + 10;
const RIGHT = LEFT + COL_W + 10;
const CONTENT_Y = PANEL.y + 25;
const ROW = 10;
const HEAD = 11;
const SECTION_GAP = 5;

/** Qué se ha conseguido en todas las partidas, misión por misión (A/D cambia de misión). */
export class ProgressScene extends BaseScene {
  private page = 0;
  private content: Phaser.GameObjects.Container | null = null;
  private leaving = false;

  constructor() {
    super('Progress');
    this.fixedCamera = true;
  }

  create(): void {
    this.leaving = false;
    this.content = null;
    this.page = Phaser.Math.Clamp(this.page, 0, MISSIONS.length - 1);
    this.cameras.main.setBackgroundColor(THEME.darkCss);

    const panel = this.add.graphics();
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 8 });

    const { found, total } = Records.totals();
    const pct = total > 0 ? Math.round((found / total) * 100) : 0;
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 4, `TOTAL ${found}/${total} (${pct}%)  ·  A/D: MISIÓN  ·  ESC: VOLVER`, {
      fontFamily: FONT_HUD,
      fontSize: '8px',
      color: '#8c98b8',
    }).setOrigin(0.5, 1);

    this.showPage();
    this.setupZoom();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  override update(): void {
    if (this.leaving) return;
    if (Controls.consume('menu') || Controls.consume('interact')) {
      playSfx('cancel');
      this.leaving = true;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
      return;
    }
    const step = Controls.consume('left') ? -1 : Controls.consume('right') ? 1 : 0;
    if (step !== 0 && MISSIONS.length > 1) {
      playSfx('cursor');
      this.page = (this.page + step + MISSIONS.length) % MISSIONS.length;
      this.showPage();
    }
  }

  private showPage(): void {
    this.content?.destroy();
    const p = Records.progress(MISSIONS[this.page]);
    const objs: Phaser.GameObjects.GameObject[] = [];
    const text = (x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle) => {
      const t = makeText(this, x, y, value, style);
      objs.push(t);
      return t;
    };
    const cx = BASE_WIDTH / 2;

    // Título de la misión con flechas para cambiar de página.
    const title = text(cx, PANEL.y + 5, missionFullLabel(p.mission), {
      fontSize: '11px',
      fontStyle: '600',
      color: THEME.ink,
    }).setOrigin(0.5, 0);
    if (MISSIONS.length > 1) {
      const ay = title.y + title.height / 2;
      const right = this.add.graphics({ x: cx + title.width / 2 + 9, y: ay });
      drawTriangle(right, 'right', THEME.accent, 3);
      const left = this.add.graphics({ x: cx - title.width / 2 - 9, y: ay }).setScale(-1, 1);
      drawTriangle(left, 'right', THEME.accent, 3);
      objs.push(left, right);
    }
    text(PANEL.x + PANEL.w - 10, PANEL.y + PANEL.h - 6, p.completed ? '★ Misión completada' : 'Misión sin completar', {
      fontSize: '9px',
      fontStyle: '600',
      color: p.completed ? THEME.accentCss : THEME.inkMuted,
    }).setOrigin(1, 1);

    const line = this.add.graphics();
    line.fillStyle(THEME.panelInner, 1).fillRect(LEFT, PANEL.y + 20, PANEL.w - 20, 1);
    objs.push(line);

    // Columna izquierda: coleccionables (íconos), finales y logros.
    let y = CONTENT_Y;
    y = this.header(text, LEFT, y, 'Coleccionables', p.collectibles);
    p.collectibles.forEach((c, i) => {
      const icon = this.add.image(LEFT + 8 + i * 22, y + 8, objKey(c.icon ?? ''));
      if (!c.found) icon.setTint(0x2a2433).setAlpha(0.18);
      objs.push(icon);
    });
    y += 18 + SECTION_GAP;
    y = this.list(text, LEFT, this.header(text, LEFT, y, 'Finales', p.endings), p.endings, true) + SECTION_GAP;
    const bonusY = this.header(text, LEFT, y, 'Logros', p.bonuses);
    // Los logros que no caben a la izquierda siguen en la columna derecha, debajo de los secretos.
    const leftRows = Math.max(1, Math.floor((PANEL.y + PANEL.h - 4 - bonusY) / ROW));
    this.list(text, LEFT, bonusY, p.bonuses.slice(0, leftRows), false);

    // Columna derecha: secretos (y el resto de los logros, si hay).
    const secretsEnd = this.list(text, RIGHT, this.header(text, RIGHT, CONTENT_Y, 'Secretos', p.secrets), p.secrets, true);
    const rest = p.bonuses.slice(leftRows);
    if (rest.length > 0) {
      const room = Math.max(1, Math.floor((PANEL.y + PANEL.h - 16 - (secretsEnd + 3)) / ROW));
      const shown = rest.length > room ? [...rest.slice(0, room - 1), { name: `+${rest.length - room + 1} logros más`, found: false }] : rest;
      this.list(text, RIGHT, secretsEnd + 3, shown as ProgressEntry[], false);
    }

    this.content = this.add.container(0, 0, objs).setDepth(2);
  }

  private header(text: TextFn, x: number, y: number, label: string, entries: ProgressEntry[]): number {
    const found = entries.filter((e) => e.found).length;
    const done = entries.length > 0 && found === entries.length;
    text(x, y, `${label} ${found}/${entries.length}`, {
      fontSize: '9px',
      fontStyle: '600',
      color: done ? THEME.accentCss : THEME.inkMuted,
    });
    return y + HEAD;
  }

  /** Una fila por entrada. `hidden`: lo que falta se muestra como "???" (sin spoilers). */
  private list(text: TextFn, x: number, y: number, entries: ProgressEntry[], hidden: boolean): number {
    entries.forEach((e, i) => {
      const label = e.found ? `★ ${e.name}` : `·  ${hidden ? '???' : e.name}`;
      const t = text(x + 2, y + i * ROW, '', { fontSize: '9px', color: e.found ? THEME.ink : THEME.inkMuted });
      fitText(t, label, COL_W - 2);
    });
    return y + entries.length * ROW;
  }
}

type TextFn = (x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
