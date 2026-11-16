import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { missionLabel, MISSIONS } from '../systems/Mission';
import { SKILLS, SkillStats, skillLevel, STAT_MAX } from '../systems/SkillStats';
import { drawPanel, fitText, makeText, THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

const PANEL = { x: 10, y: 4, w: BASE_WIDTH - 20, h: 160 };
const TAB_Y = PANEL.y + 5;
const TAB_H = 15;
const LEFT = PANEL.x + 10;
const COL_W = (PANEL.w - 30) / 2;
const RIGHT = LEFT + COL_W + 10;
const CONTENT_Y = PANEL.y + 28;
const ROW = 10;
const BAR_H = 4;

/** Las stats de los minijuegos que se repiten, con una pestaña por minijuego (A/D cambia). */
export class StatsScene extends BaseScene {
  private page = 0;
  private content: Phaser.GameObjects.Container | null = null;
  private leaving = false;

  constructor() {
    super('Stats');
    this.fixedCamera = true;
  }

  create(): void {
    this.leaving = false;
    this.content = null;
    this.page = Phaser.Math.Clamp(this.page, 0, SKILLS.length - 1);
    this.cameras.main.setBackgroundColor(THEME.darkCss);

    const panel = this.add.graphics();
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 8 });
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 4, 'A/D: MINIJUEGO  ·  ESC: VOLVER', {
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
    if (step !== 0) this.goTo((this.page + step + SKILLS.length) % SKILLS.length);
  }

  private goTo(page: number): void {
    if (page === this.page) return;
    playSfx('cursor');
    this.page = page;
    this.showPage();
  }

  private showPage(): void {
    this.content?.destroy();
    const objs: Phaser.GameObjects.GameObject[] = [];
    const text = (x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text => {
      const t = makeText(this, x, y, value, style);
      objs.push(t);
      return t;
    };
    const g = this.add.graphics();
    objs.push(g);

    // Las pestañas: una por minijuego, con su nivel. Se pueden tocar.
    const tabW = (PANEL.w - 20) / SKILLS.length;
    SKILLS.forEach((def, i) => {
      const x = LEFT + i * tabW;
      const on = i === this.page;
      const rec = SkillStats.get(def.id);
      g.fillStyle(on ? def.color : THEME.panelInner, 1).fillRoundedRect(x + 1, TAB_Y, tabW - 2, TAB_H, 4);
      const label = rec.plays > 0 ? `${def.name} · Nv ${skillLevel(def, rec)}` : def.name;
      const t = text(x + tabW / 2, TAB_Y + TAB_H / 2, label, {
        fontSize: '9px',
        fontStyle: '600',
        color: on ? THEME.white : rec.plays > 0 ? THEME.ink : THEME.inkMuted,
      }).setOrigin(0.5);
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goTo(i));
    });
    g.fillStyle(THEME.panelInner, 1).fillRect(LEFT, TAB_Y + TAB_H + 3, PANEL.w - 20, 1);

    const def = SKILLS[this.page];
    const rec = SkillStats.get(def.id);
    const played = rec.plays > 0;

    // Columna izquierda: las stats con su barra y el nivel.
    let y = CONTENT_Y;
    text(LEFT, y, played ? `Nivel ${skillLevel(def, rec)} de 10` : 'Habilidades', { fontSize: '9px', fontStyle: '600', color: played ? `#${def.color.toString(16).padStart(6, '0')}` : THEME.inkMuted });
    y += ROW + 3;
    for (const st of def.stats) {
      const v = rec.stats[st.id] ?? 0;
      text(LEFT + 2, y, st.name, { fontSize: '9px', color: THEME.ink });
      text(LEFT + COL_W, y, `${v}`, { fontSize: '9px', fontStyle: '600', color: v > 0 ? THEME.ink : THEME.inkMuted }).setOrigin(1, 0);
      const by = y + ROW + 1;
      g.fillStyle(THEME.panelInner, 1).fillRoundedRect(LEFT + 2, by, COL_W - 2, BAR_H, 2);
      if (v > 0) g.fillStyle(def.color, 1).fillRoundedRect(LEFT + 2, by, Math.max(BAR_H, ((COL_W - 2) * v) / STAT_MAX), BAR_H, 2);
      y = by + BAR_H + 6;
    }

    // Debajo: los contadores y los récords.
    y += 2;
    text(LEFT, y, 'Récords', { fontSize: '9px', fontStyle: '600', color: THEME.inkMuted });
    y += ROW + 1;
    const rows: Array<[string, string]> = [
      ...def.counters.map((c): [string, string] => [c.name, `${rec.counters[c.id] ?? 0}`]),
      ...def.best.map((b): [string, string] => [b.name, `${rec.best[b.id] ?? 0}${b.suffix ?? ''}`]),
    ];
    for (const [name, value] of rows) {
      const t = text(LEFT + 2, y, '', { fontSize: '9px', color: played ? THEME.ink : THEME.inkMuted });
      fitText(t, name, COL_W - 24);
      text(LEFT + COL_W, y, value, { fontSize: '9px', fontStyle: '600', color: played ? THEME.ink : THEME.inkMuted }).setOrigin(1, 0);
      y += ROW;
    }

    // Columna derecha: la mejor partida de cada misión.
    let ry = CONTENT_Y;
    text(RIGHT, ry, 'Por misión', { fontSize: '9px', fontStyle: '600', color: THEME.inkMuted });
    ry += ROW + 3;
    const entries = MISSIONS.filter((m) => rec.missions[m.id]);
    if (entries.length === 0) {
      text(RIGHT + 2, ry, 'Todavía no lo juegas. Las stats suben cada vez que lo juegues en una misión, según cómo te vaya, y quedan guardadas aunque empieces una partida nueva.', {
        fontSize: '9px',
        color: THEME.inkMuted,
        wordWrap: { width: COL_W - 4 },
        lineSpacing: 1,
      });
    }
    for (const m of entries) {
      if (ry > PANEL.y + PANEL.h - 30) break;
      text(RIGHT + 2, ry, missionLabel(m), { fontSize: '8px', fontStyle: '600', color: THEME.inkMuted });
      const line = text(RIGHT + 6, ry + 9, rec.missions[m.id].line, { fontSize: '9px', color: THEME.ink, wordWrap: { width: COL_W - 8 } });
      ry += 9 + Math.ceil(line.height) + 4;
    }
    if (played) {
      text(PANEL.x + PANEL.w - 10, PANEL.y + PANEL.h - 6, `Jugado ${rec.plays} ${rec.plays === 1 ? 'vez' : 'veces'}`, {
        fontSize: '9px',
        color: THEME.inkMuted,
      }).setOrigin(1, 1);
    }

    this.content = this.add.container(0, 0, objs).setDepth(2);
  }
}
