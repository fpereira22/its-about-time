import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import { drawPanel, makeText, THEME } from './theme';

const SHOW_MS = 2600;
/** Bajo los paneles del HUD (que terminan en y≈32). */
const TOP = 36;

/** Cartel que baja desde arriba con el nombre de la calle o la próxima estación. */
export class Banner {
  private current: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  show(title: string, subtitle?: string): void {
    this.hide(true);
    playSfx('banner');
    const scene = this.scene;
    const titleText = makeText(scene, 0, 0, title.toUpperCase(), {
      fontFamily: FONT_HUD,
      fontSize: '8px',
      color: THEME.white,
    }).setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [titleText];
    let h = 15;
    let w = titleText.width;
    if (subtitle) {
      const sub = makeText(scene, 0, 12, subtitle, { fontSize: '9px', color: '#b8c4e0' }).setOrigin(0.5, 0);
      parts.push(sub);
      w = Math.max(w, sub.width);
      h = 25;
    }
    w = Math.ceil(w) + 18;
    titleText.setY(4);
    const bg = scene.add.graphics();
    drawPanel(bg, -w / 2, 0, w, h, { radius: 5, fill: THEME.dark, edge: 0x0a0e18 });
    const accent = scene.add.graphics().fillStyle(THEME.accent, 1).fillRect(-w / 2 + 5, h - 3, w - 10, 1);

    const box = scene.add.container(BASE_WIDTH / 2, -h - 6, [bg, accent, ...parts]).setDepth(310);
    this.current = box;
    scene.tweens.add({ targets: box, y: TOP, duration: 240, ease: 'Back.Out' });
    scene.time.delayedCall(SHOW_MS, () => {
      if (this.current === box) this.hide(false);
    });
  }

  private hide(immediate: boolean): void {
    const box = this.current;
    if (!box) return;
    this.current = null;
    if (immediate) {
      box.destroy();
      return;
    }
    this.scene.tweens.add({
      targets: box,
      y: -40,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.In',
      onComplete: () => box.destroy(),
    });
  }
}
