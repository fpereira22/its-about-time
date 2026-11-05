import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import { drawPanel, makeText, THEME } from './theme';

export class BusViewPrompt {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.label = makeText(scene, 0, 0, '', {
      fontFamily: FONT_HUD,
      fontSize: '8px',
      color: '#f8f8f0',
    }).setOrigin(0.5, 0.5);

    this.container = scene.add
      .container(BASE_WIDTH / 2, BASE_HEIGHT - 12, [this.bg, this.label])
      .setDepth(350)
      .setAlpha(0)
      .setVisible(false);

    // Permitir clic con el mouse
    this.container.setSize(180, 16);
    this.container.setInteractive({ useHandCursor: true });
    this.container.on('pointerdown', () => {
      EventSystem.emit('toggle-ride-view');
    });

    EventSystem.onScene(scene, 'bus-ride-status', (status) => {
      if (status.active) {
        this.show(status.mode === 'exterior');
      } else {
        this.hide();
      }
    });
  }

  private show(isExterior: boolean): void {
    const text = isExterior
      ? 'V: Ver interior  ·  E: Tocar timbre'
      : 'V: Ver micro por fuera (recorrido)';

    this.label.setText(text);
    const w = Math.ceil(this.label.width) + 16;
    const h = 15;

    this.bg.clear();
    drawPanel(this.bg, -w / 2, -h / 2, w, h, {
      radius: 4,
      fill: THEME.dark,
      edge: 0xd97706,
      alpha: 0.94,
    });

    this.container.setSize(w, h);
    this.visible = true;
    this.container.setVisible(true);
    this.container.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 180,
    });
  }

  private hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.container.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 180,
      onComplete: () => this.container.setVisible(false),
    });
  }
}
