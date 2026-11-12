import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

/**
 * Base de los minijuegos de la misión 8 (pool, pimpón, las atracciones del Parque del Café y el tejo):
 * cámara fija, título arriba, ayuda abajo, cartel central (intro y resultados), globo de diálogo y textos que
 * flotan. Cada minijuego dibuja lo suyo y llama a `finish` con su resultado.
 */
export abstract class MiniScene<R> extends BaseScene {
  protected done!: (r: R) => void;
  protected leaving = false;
  protected titleText!: Phaser.GameObjects.Text;
  protected hintText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private sayText!: Phaser.GameObjects.Text;
  private sayMs = 0;
  private floats: Array<{ t: Phaser.GameObjects.Text; life: number }> = [];
  protected bannerOn = false;

  constructor(key: string) {
    super(key);
    this.fixedCamera = true;
  }

  protected initMini(done: (r: R) => void): void {
    this.done = done;
    this.leaving = false;
    this.floats = [];
    this.sayMs = 0;
    this.bannerOn = false;
  }

  /** Textos comunes; llamar en `create` después de dibujar el fondo. */
  protected createUi(bg = '#14121a'): void {
    this.cameras.main.setBackgroundColor(bg);
    this.titleText = this.addText(6, 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f8e070' }).setDepth(50);
    this.hintText = this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 11, '', { fontSize: '8px', color: '#dfe6f4' }).setOrigin(0.5, 0).setDepth(50);
    this.sayText = this.addText(0, 0, '', { fontSize: '8px', color: '#2a2433', backgroundColor: '#fbf6ee', padding: { x: 3, y: 2 }, wordWrap: { width: 150 } })
      .setOrigin(0.5, 1)
      .setDepth(55)
      .setVisible(false);
    this.bannerBg = this.add.graphics().setDepth(60);
    this.bannerText = this.addText(BASE_WIDTH / 2, BASE_HEIGHT / 2, '', { fontSize: '9px', fontStyle: '600', color: THEME.ink, align: 'center', wordWrap: { width: 270 } })
      .setOrigin(0.5)
      .setDepth(61);
    this.setupZoom();
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  /** Barras oscuras de arriba y abajo (para que se lean el título y la ayuda). */
  protected drawBars(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x0c1020, 0.75).fillRect(0, 0, BASE_WIDTH, 15);
    g.fillStyle(0x0c1020, 0.75).fillRect(0, BASE_HEIGHT - 13, BASE_WIDTH, 13);
  }

  protected banner(text: string, y = BASE_HEIGHT / 2): void {
    this.bannerOn = true;
    this.bannerText.setText(text).setY(y).setVisible(true);
    const b = this.bannerText.getBounds();
    this.bannerBg.clear().fillStyle(0xfbf6ee, 0.96).fillRoundedRect(b.x - 8, b.y - 6, b.width + 16, b.height + 12, 6).setVisible(true);
    this.bannerBg.lineStyle(1, 0x2a2433, 1).strokeRoundedRect(b.x - 8, b.y - 6, b.width + 16, b.height + 12, 6);
  }

  protected hideBanner(): void {
    this.bannerOn = false;
    this.bannerText.setVisible(false);
    this.bannerBg.setVisible(false);
  }

  /** Globo de diálogo sobre (x, y) por `ms`. */
  protected say(text: string, x: number, y: number, ms = 1600): void {
    this.sayText.setText(text).setPosition(Math.round(Phaser.Math.Clamp(x, 80, BASE_WIDTH - 80)), Math.round(y)).setVisible(true);
    this.sayMs = ms;
  }

  protected float(text: string, color: string, x: number, y: number, life = 0.8): void {
    const t = this.addText(Math.round(x), Math.round(y), text, { fontSize: '8px', fontStyle: '600', color, stroke: '#14182a', strokeThickness: 3 }).setOrigin(0.5).setDepth(56);
    this.floats.push({ t, life });
  }

  /** Avanza los globos y los textos flotantes (llamar en cada `update`). */
  protected tickUi(delta: number): void {
    if (this.sayMs > 0) {
      this.sayMs -= delta;
      if (this.sayMs <= 0) this.sayText.setVisible(false);
    }
    this.floats = this.floats.filter((f) => {
      f.life -= delta / 1000;
      f.t.y -= delta * 0.02;
      f.t.setAlpha(Math.min(1, f.life * 2));
      if (f.life > 0) return true;
      f.t.destroy();
      return false;
    });
  }

  protected finish(result: R): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.done(result));
  }
}
