import Phaser from 'phaser';
import { playMusic } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { CREATOR, GAME_TITLE } from '../config/game';
import { Controls } from '../systems/Controls';
import { missionFullLabel, MISSIONS } from '../systems/Mission';
import { Records } from '../systems/Records';
import { StoryState } from '../systems/StoryState';
import { MenuList } from '../ui/MenuList';
import { openShareForm } from '../ui/ShareForm';
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
  { text: 'MÚSICA', kind: 'heading' },
  { text: 'Banda sonora original, sintetizada en tu navegador', kind: 'body' },
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
  { text: CREATOR.name, kind: 'body' },
  { text: '', kind: 'gap' },
  { text: 'ENCUÉNTRAME EN', kind: 'heading' },
  { text: CREATOR.github.label, kind: 'link', url: CREATOR.github.url },
  { text: CREATOR.linkedin.label, kind: 'link', url: CREATOR.linkedin.url },
  { text: CREATOR.portfolio.label, kind: 'link', url: CREATOR.portfolio.url },
  { text: '', kind: 'gap' },
  { text: '¡Gracias por jugar!', kind: 'heading' },
];

const SCROLL_SPEED = 18;
const TOP = 14;
// Abajo queda lugar para los botones («Compartir mi final» y «Volver») cuando el scroll termina.
const BOTTOM = BASE_HEIGHT - 38;

export interface CreditsSceneData {
  /** Vienen de terminar la última misión: salen solos, E/Esc los salta y al acabar sigue el resumen del final. */
  finale?: boolean;
}

/** Lo que se queda quieto el final de los créditos antes de pasar solo al resumen. */
const FINALE_HOLD_MS = 3000;
/** Pantalla negra de «Continuará...» antes de los créditos del final: aparece el texto y se queda un rato. */
const TO_BE_CONTINUED_MS = 5200;

/**
 * Créditos con scroll vertical. Desde el título: Esc vuelve; al llegar al final salen los botones (compartir el
 * final, volver). Tras la última misión (`finale`): arrancan solos, E/Esc los salta y terminan en el resumen del final.
 */
export class CreditsScene extends BaseScene {
  private roll!: Phaser.GameObjects.Container;
  private rollHeight = 0;
  /** Posición exacta del scroll; el contenedor se dibuja en píxeles enteros. */
  private rollY = 0;
  private leaving = false;
  private menu: MenuList | null = null;
  /** «Compartir» abierto encima: cierra lo que haya. */
  private closeForm: (() => void) | null = null;
  private hint!: Phaser.GameObjects.Text;
  private finale = false;
  /** Ya se terminó de subir (modo final): cuenta atrás para pasar al resumen. */
  private holdLeft = FINALE_HOLD_MS;
  /** Lo que falta del «Continuará...» (modo final); mientras dure, los créditos no suben ni se pueden saltar. */
  private introLeft = 0;

  constructor() {
    super('Credits');
    this.fixedCamera = true;
  }

  init(data?: CreditsSceneData): void {
    this.finale = data?.finale === true;
    // Phaser conserva los datos del último start() si el siguiente no trae: sin esto, abrir los créditos desde el
    // título después del final los volvería a abrir como «final».
    this.sys.settings.data = {};
    this.holdLeft = FINALE_HOLD_MS;
    this.introLeft = this.finale ? TO_BE_CONTINUED_MS : 0;
  }

  create(): void {
    this.leaving = false;
    this.menu = null;
    this.closeForm = null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.closeForm?.());
    this.cameras.main.setBackgroundColor(THEME.darkCss);
    // En el final, primero el «Continuará...» en silencio; la música entra con los créditos.
    playMusic(this.finale ? null : 'credits_final');
    // Al terminar la última misión se guarda aquí (el resumen, que lo hacía, viene después de los créditos).
    if (this.finale) StoryState.save();

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
    this.hint = this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 5, this.finale ? 'E / Esc: saltar' : 'E / Esc: volver', { fontFamily: FONT_HUD, fontSize: '8px', color: '#8c98b8' })
      .setOrigin(0.5, 1)
      .setDepth(6);

    if (this.finale) this.createToBeContinued();

    this.setupZoom();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  /** Pantalla negra con «Continuará...» (y notas que flotan): tapa los créditos y se va sola. */
  private createToBeContinued(): void {
    const cover = this.add.container(0, 0).setDepth(30);
    cover.add(this.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x000000, 1).setOrigin(0));
    const text = this.addText(BASE_WIDTH / 2, BASE_HEIGHT / 2, 'Continuará...', { fontSize: '16px', fontStyle: '600', color: '#f4f0e6' })
      .setOrigin(0.5)
      .setAlpha(0);
    cover.add(text);
    this.tweens.add({ targets: text, alpha: 1, duration: 1500, delay: 900 });
    // Notas sueltas, como la salsa vieja que suena a lo lejos.
    this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => {
        const note = this.addText(Phaser.Math.Between(30, BASE_WIDTH - 30), Phaser.Math.Between(110, 150), '♪', { fontSize: '10px', color: '#5a5a68' })
          .setOrigin(0.5)
          .setAlpha(0);
        cover.add(note);
        this.tweens.add({ targets: note, alpha: 1, y: note.y - 18, duration: 900, yoyo: true, onComplete: () => note.destroy() });
      },
    });
    this.time.delayedCall(TO_BE_CONTINUED_MS - 700, () => {
      playMusic('credits_final');
      this.tweens.add({ targets: cover, alpha: 0, duration: 700, onComplete: () => cover.destroy() });
    });
  }

  override update(_time: number, delta: number): void {
    if (this.introLeft > 0) {
      // Sin saltar ni subir: el E con que se cerró el diálogo anterior no debe comerse el «Continuará...».
      this.introLeft -= delta;
      Controls.consume('interact');
      Controls.consume('menu');
      return;
    }
    // Sube hasta que la última línea queda a la vista (o centrado si cabe entero) y se detiene.
    const visible = BOTTOM - TOP;
    const stopY = this.rollHeight <= visible ? TOP + (visible - this.rollHeight) / 2 : BOTTOM - this.rollHeight;
    if (this.rollY > stopY) {
      this.rollY = Math.max(stopY, this.rollY - (SCROLL_SPEED * delta) / 1000);
      this.roll.y = Math.round(this.rollY);
    } else if (this.finale) {
      this.holdLeft -= delta;
      if (this.holdLeft <= 0) this.toSummary();
    } else if (!this.menu) {
      this.showButtons();
    }
    if (this.leaving || this.closeForm) return;
    if (this.finale) {
      if (Controls.consume('interact') || Controls.consume('menu')) this.toSummary();
      return;
    }
    if (this.menu) {
      this.menu.update();
      if (Controls.consume('menu')) this.exit();
    } else if (Controls.consume('interact') || Controls.consume('menu')) {
      this.exit();
    }
  }

  /** Final del juego: de los créditos al resumen de la última misión. */
  private toSummary(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MissionComplete', { afterCredits: true }));
  }

  private exit(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }

  /** Al terminar el scroll: compartir el final (si ya terminó el juego) y volver al título. */
  private showButtons(): void {
    this.hint.setVisible(false);
    const finished = Records.isCompleted(MISSIONS[MISSIONS.length - 1].id);
    const items = [
      ...(finished ? [{ label: 'Compartir mi final', badge: '★', action: () => this.openShare() }] : []),
      { label: 'Volver al título', action: () => this.exit() },
    ];
    this.menu = new MenuList(this, items, { x: BASE_WIDTH / 2, y: BASE_HEIGHT - 28, horizontal: true, depth: 20 });
    this.menu.container.setAlpha(0);
    this.tweens.add({ targets: this.menu.container, alpha: 1, duration: 400 });
  }

  private openShare(): void {
    if (this.leaving || this.closeForm) return;
    this.closeForm = openShareForm(
      () => {
        this.closeForm = null;
      },
      { finale: true },
    );
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
