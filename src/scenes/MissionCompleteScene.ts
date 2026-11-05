import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { objKey } from '../art/SpriteRegistry';
import { PAL } from '../art/palette';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { currentMission, MISSIONS, missionSummary } from '../systems/Mission';
import type { MissionDef } from '../types/mission';
import { startMission } from './TitleScene';
import { StoryState } from '../systems/StoryState';
import { drawPanel, THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';
import { MenuList } from '../ui/MenuList';

const PANEL = { x: 24, y: 24, w: BASE_WIDTH - 48, h: 128 };
const STAGGER_MS = 160;
const CONFETTI_COLORS = [PAL.red, PAL.yellow, PAL.green, 0x2f6fd0, PAL.orange, PAL.white].map((c) =>
  typeof c === 'string' ? Phaser.Display.Color.HexStringToColor(c).color : c,
);

/** Resumen al encontrar a la mamá: tiempo, ruta, coleccionables, secretos y logros. */
export class MissionCompleteScene extends BaseScene {
  private menu: MenuList | null = null;
  private leaving = false;

  constructor() {
    super('MissionComplete');
    this.fixedCamera = true;
  }

  create(): void {
    this.menu = null;
    this.leaving = false;
    const s = missionSummary();
    StoryState.save();
    this.cameras.main.setBackgroundColor('#1c2a48');
    this.createConfetti();

    const cx = BASE_WIDTH / 2;
    const L = PANEL.x + 18;
    const R = PANEL.x + PANEL.w - 18;
    const panel = this.add.graphics().setDepth(1);
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 8 });

    const header = this.addText(cx, 8, '¡MISIÓN COMPLETADA!', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0d048' })
      .setOrigin(0.5, 0)
      .setDepth(2);
    this.tweens.add({ targets: header, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Cada fila entra con un pequeño desfase.
    const rows: Phaser.GameObjects.GameObject[][] = [];
    const t = (x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) =>
      this.addText(x, y, text, style).setDepth(2);

    rows.push([t(cx, PANEL.y + 7, s.title, { fontSize: '13px', fontStyle: '600', color: THEME.ink }).setOrigin(0.5, 0)]);
    rows.push([
      t(L, PANEL.y + 28, 'Tiempo', { color: THEME.inkMuted }),
      t(R, PANEL.y + 28, s.time, { color: THEME.ink, fontStyle: '600' }).setOrigin(1, 0),
    ]);
    rows.push([
      t(L, PANEL.y + 42, 'Ruta', { color: THEME.inkMuted }),
      t(R, PANEL.y + 42, s.route, { color: THEME.ink, fontStyle: '600' }).setOrigin(1, 0),
    ]);
    const line = this.add.graphics().setDepth(2);
    line.fillStyle(THEME.panelInner, 1).fillRect(L, PANEL.y + 58, R - L, 1);

    const found = s.collectibles.filter((c) => c.found).length;
    rows.push([t(L, PANEL.y + 64, `Coleccionables ${found}/${s.collectibles.length}`, { color: THEME.inkMuted })]);
    rows.push([
      t(L, PANEL.y + 104, `Secretos ${s.secrets.found}/${s.secrets.total}`, {
        color: s.secrets.found > 0 ? THEME.accentCss : THEME.inkMuted,
        fontSize: '9px',
      }),
    ]);
    // Los logros que caben en el panel (si son muchos, los últimos se resumen en «+N logros más»).
    const maxBonus = Math.max(1, Math.floor((PANEL.h - 82) / 11));
    const shown = s.bonuses.length > maxBonus ? [...s.bonuses.slice(0, maxBonus - 1), `+${s.bonuses.length - maxBonus + 1} logros más`] : s.bonuses;
    rows.push([
      t(R, PANEL.y + 64, 'Logros', { color: THEME.inkMuted }).setOrigin(1, 0),
      ...(shown.length > 0
        ? shown.map((b, i) =>
            t(R, PANEL.y + 78 + i * 11, `★ ${b}`, { color: THEME.accentCss, fontSize: '9px' }).setOrigin(1, 0),
          )
        : [t(R, PANEL.y + 78, 'Sin logros extra', { color: THEME.inkMuted, fontSize: '9px' }).setOrigin(1, 0)]),
    ]);

    rows.forEach((objs, i) => {
      for (const o of objs) {
        const go = o as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
        const y = go.y;
        go.setAlpha(0);
        go.y = y + 5;
        this.tweens.add({ targets: go, alpha: 1, y, duration: 260, delay: 300 + i * STAGGER_MS, ease: 'Cubic.Out' });
      }
    });

    // Coleccionables: los encontrados aparecen con un "pop".
    const iconsDelay = 300 + rows.length * STAGGER_MS;
    s.collectibles.forEach((c, i) => {
      const icon = this.add.image(L + 8 + i * 22, PANEL.y + 92, objKey(c.icon)).setDepth(2).setScale(0);
      if (!c.found) icon.setTint(0x2a2433).setAlpha(0.18);
      this.tweens.add({
        targets: icon,
        scale: 1,
        duration: c.found ? 380 : 200,
        delay: iconsDelay + i * 120,
        ease: c.found ? 'Back.Out' : 'Cubic.Out',
      });
    });

    const next = MISSIONS[MISSIONS.indexOf(currentMission()) + 1];
    this.time.delayedCall(iconsDelay + s.collectibles.length * 120 + 250, () => {
      this.menu = new MenuList(
        this,
        [
          ...(next ? [{ label: 'Siguiente misión', action: () => this.goNext(next) }] : []),
          { label: 'Volver al título', action: () => this.go('Title') },
          { label: 'Créditos', action: () => this.go('Credits') },
        ],
        { x: cx, y: PANEL.y + PANEL.h + 4, horizontal: true },
      );
      this.menu.container.setAlpha(0);
      this.tweens.add({ targets: this.menu.container, alpha: 1, duration: 200 });
    });

    this.setupZoom();
    this.cameras.main.fadeIn(400, 0, 0, 0);
    // Fanfarria primero; la música de victoria entra cuando termina.
    playMusic(null);
    playSfx('complete');
    this.time.delayedCall(1600, () => playMusic('complete'));
  }

  override update(): void {
    if (!this.leaving) this.menu?.update();
  }

  private go(scene: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene));
  }

  private goNext(m: MissionDef): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => startMission(this, m));
  }

  /** Confeti que cae detrás del panel. */
  private createConfetti(): void {
    for (let i = 0; i < 44; i++) {
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const piece = this.add
        .rectangle(Phaser.Math.Between(0, BASE_WIDTH), Phaser.Math.Between(-BASE_HEIGHT, 0), 2, 3, color)
        .setDepth(0)
        .setAngle(Phaser.Math.Between(0, 90));
      this.tweens.add({
        targets: piece,
        y: BASE_HEIGHT + 8,
        x: piece.x + Phaser.Math.Between(-24, 24),
        angle: piece.angle + Phaser.Math.Between(180, 540),
        duration: Phaser.Math.Between(3200, 5600),
        delay: Phaser.Math.Between(0, 2400),
        repeat: -1,
        onRepeat: () => piece.setPosition(Phaser.Math.Between(0, BASE_WIDTH), -6),
      });
    }
  }
}
