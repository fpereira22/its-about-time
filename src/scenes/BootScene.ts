import Phaser from 'phaser';
import { FONT_HUD, FONT_TEXT } from '../config/display';

/** Espera a que carguen las fuentes de Google Fonts (con tope de tiempo) y pasa a Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const fonts = [`10px ${FONT_TEXT}`, `600 10px ${FONT_TEXT}`, `8px ${FONT_HUD}`];
    const loadFonts = Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => undefined);
    const timeout = new Promise((resolve) => window.setTimeout(resolve, 3000));
    void Promise.race([loadFonts, timeout]).then(() => this.scene.start('Preload'));
  }
}
