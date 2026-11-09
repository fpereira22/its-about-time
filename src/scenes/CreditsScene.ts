import Phaser from 'phaser';
import { playMusic } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { GAME_TITLE } from '../config/game';
import { Controls } from '../systems/Controls';
import { missionFullLabel, MISSIONS } from '../systems/Mission';
import { THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

type Line = { text: string; kind: 'title' | 'heading' | 'body' | 'note' | 'link' | 'gap'; url?: string };

const LINK_COLOR = '#7fb0ff';
const LINK_HOVER = '#f0d048';

const CREDITS: Line[] = [
  { text: GAME_TITLE, kind: 'title' },
  { text: 'Un juego de Felipe Pereira', kind: 'body' },
  { text: '', kind: 'gap' },
  ...MISSIONS.map((m): Line => ({ text: missionFullLabel(m), kind: 'body' })),
  { text: '', kind: 'gap' },
  { text: 'TECNOLOGÍA', kind: 'heading' },
  { text: 'Hecho con Phaser 3, TypeScript y Vite', kind: 'body' },
  { text: '', kind: 'gap' },
  { text: 'TIPOGRAFÍAS', kind: 'heading' },
  { text: '"Pixelify Sans" y "Silkscreen" (Google Fonts)', kind: 'body' },
  { text: '', kind: 'gap' },
  { text: 'ARTE', kind: 'heading' },
  { text: 'Arte placeholder diseñado con herramientas de arte digital', kind: 'body' },
  { text: '', kind: 'gap' },
  { text: 'MAPAS', kind: 'heading' },
  { text: 'Datos de calles inspirados en', kind: 'body' },
  { text: '© OpenStreetMap contributors', kind: 'body' },
  { text: '', kind: 'gap' },
  // \u200c evita la ligadura "fi" de Pixelify Sans, que a 9px se lee como "A".
  { text: 'Juego de f\u200cicción. Sin relación con Metro de Santiago,', kind: 'note' },
  { text: 'Red Movilidad, EFE ni marcas reales.', kind: 'note' },
  { text: 'La Universidad Antonio Varas es inventada.', kind: 'note' },
  { text: 'La Pontificia U. Cristiana-Caleña, también.', kind: 'note' },
  { text: '', kind: 'gap' },
  // Al final: el scroll se detiene aquí y los enlaces quedan a la vista para hacer clic.
  { text: 'CREADO POR', kind: 'heading' },
  { text: 'Felipe Pereira', kind: 'body' },
  { text: 'GitHub: fpereira22', kind: 'link', url: 'https://github.com/fpereira22' },
  { text: 'LinkedIn: felipe-pereira-alarcon', kind: 'link', url: 'https://www.linkedin.com/in/felipe-pereira-alarcon/' },
  { text: 'Portafolio: fpereiradev.sppa.cl', kind: 'link', url: 'https://fpereiradev.sppa.cl/' },
  { text: '', kind: 'gap' },
  { text: '¡Gracias por jugar!', kind: 'heading' },
];

const SCROLL_SPEED = 18;
const TOP = 14;
const BOTTOM = BASE_HEIGHT - 16;

/** Créditos con scroll vertical. E o Esc vuelve al título. */
export class CreditsScene extends BaseScene {
  private roll!: Phaser.GameObjects.Container;
  private rollHeight = 0;
  /** Posición exacta del scroll; el contenedor se dibuja en píxeles enteros. */
  private rollY = 0;
  private leaving = false;

  constructor() {
    super('Credits');
    this.fixedCamera = true;
  }

  create(): void {
    this.leaving = false;
    this.cameras.main.setBackgroundColor(THEME.darkCss);
    playMusic('credits');

    const parts: Phaser.GameObjects.GameObject[] = [];
    let y = 0;
    for (const line of CREDITS) {
      if (line.kind === 'gap') {
        y += 10;
        continue;
      }
      const style: Phaser.Types.GameObjects.Text.TextStyle =
        line.kind === 'title'
          ? { fontSize: '18px', fontStyle: '600', color: '#ffffff' }
          : line.kind === 'heading'
            ? { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0d048' }
            : line.kind === 'note'
              ? { fontSize: '9px', color: '#8c98b8' }
              : line.kind === 'link'
                ? { fontSize: '9px', color: LINK_COLOR }
                : { fontSize: '10px', color: '#d8e0f0' };
      const t = this.addText(BASE_WIDTH / 2, y, line.text, style).setOrigin(0.5, 0);
      parts.push(t);
      if (line.url) parts.push(this.makeLink(t, line.url));
      y += Math.ceil(t.height) + (line.kind === 'heading' ? 3 : 2);
    }
    this.rollHeight = y;
    this.rollY = Math.round(BASE_HEIGHT * 0.45);
    this.roll = this.add.container(0, this.rollY, parts);

    // Máscara suave: bandas del color de fondo arriba y abajo.
    const fade = this.add.graphics().setDepth(5);
    for (let i = 0; i < 8; i++) {
      const a = 1 - i / 8;
      fade.fillStyle(THEME.dark, a).fillRect(0, TOP - 8 + i * 2, BASE_WIDTH, 2);
      fade.fillStyle(THEME.dark, a).fillRect(0, BOTTOM + 6 - i * 2, BASE_WIDTH, 2);
    }
    fade.fillStyle(THEME.dark, 1).fillRect(0, 0, BASE_WIDTH, TOP - 8).fillRect(0, BOTTOM + 8, BASE_WIDTH, BASE_HEIGHT);
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 5, 'E / Esc: volver', { fontFamily: FONT_HUD, fontSize: '8px', color: '#8c98b8' })
      .setOrigin(0.5, 1)
      .setDepth(6);

    this.setupZoom();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  override update(_time: number, delta: number): void {
    // Sube hasta que la última línea queda a la vista (o centrado si cabe entero) y se detiene.
    const visible = BOTTOM - TOP;
    const stopY = this.rollHeight <= visible ? TOP + (visible - this.rollHeight) / 2 : BOTTOM - this.rollHeight;
    if (this.rollY > stopY) {
      this.rollY = Math.max(stopY, this.rollY - (SCROLL_SPEED * delta) / 1000);
      this.roll.y = Math.round(this.rollY);
    }
    if (this.leaving) return;
    if (Controls.consume('interact') || Controls.consume('menu')) {
      this.leaving = true;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
    }
  }

  /** Texto clicable con el mouse: se subraya al pasar y abre `url` en una pestaña nueva. Devuelve el subrayado. */
  private makeLink(t: Phaser.GameObjects.Text, url: string): Phaser.GameObjects.Rectangle {
    const underline = this.add
      .rectangle(t.x, t.y + t.height - 1, t.width, 1, Phaser.Display.Color.HexStringToColor(LINK_HOVER).color)
      .setOrigin(0.5, 0)
      .setVisible(false);
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => {
      t.setColor(LINK_HOVER);
      underline.setVisible(true);
    });
    t.on('pointerout', () => {
      t.setColor(LINK_COLOR);
      underline.setVisible(false);
    });
    t.on('pointerdown', () => window.open(url, '_blank', 'noopener'));
    return underline;
  }
}
