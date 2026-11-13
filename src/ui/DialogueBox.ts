import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { FONT_TEXT } from '../config/display';
import { Controls } from '../systems/Controls';
import { Dialogue, type DialoguePresenter, type DialogueStep } from '../systems/DialogueManager';
import { Settings } from '../systems/Settings';
import { drawPanel, drawTriangle, makeText, THEME } from './theme';

const BOX = { x: 8, y: 124, w: 304, h: 50 };
const PAD_X = 11;
const PAD_Y = 7;
const LINES_PER_PAGE = 3;
const LINE_SPACING = 2;
const CHOICE_ROW = 13;

/** Caja de diálogo con efecto máquina de escribir y lista de opciones (W/S + E). */
/** Lo que otras piezas de UI necesitan saber de la caja de diálogo (ej. el chat de Sira, para no quedar tapado). */
export const dialogueUi = {
  /** Borde superior (px de pantalla) del cuadro de opciones mientras se ve; null si no hay opciones. */
  choicesTop: null as number | null,
};

export class DialogueBox implements DialoguePresenter {
  private readonly root: Phaser.GameObjects.Container;
  private readonly nameTag: Phaser.GameObjects.Container;
  private readonly nameBg: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly measurer: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly choiceRoot: Phaser.GameObjects.Container;

  private step: DialogueStep | null = null;
  private pages: string[] = [];
  private page = 0;
  private chars: string[] = [];
  private shown = 0;
  private open = false;
  private choicesVisible = false;
  private selected = 0;
  private cursor: Phaser.GameObjects.Graphics | null = null;
  /** Borde superior de cada opción dentro del cuadro (las largas ocupan dos líneas). */
  private choiceRows: number[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    const panel = scene.add.graphics();
    drawPanel(panel, BOX.x, BOX.y, BOX.w, BOX.h);

    this.body = makeText(scene, BOX.x + PAD_X, BOX.y + PAD_Y, '', {
      color: THEME.ink,
      lineSpacing: LINE_SPACING,
    });
    this.measurer = makeText(scene, 0, 0, '', {
      wordWrap: { width: BOX.w - PAD_X * 2, useAdvancedWrap: true },
    }).setVisible(false);

    this.nameBg = scene.add.graphics();
    this.nameText = makeText(scene, 0, 0, '', {
      fontFamily: FONT_TEXT,
      fontStyle: '600',
      fontSize: '9px',
      color: THEME.white,
    }).setOrigin(0, 0.5);
    this.nameTag = scene.add.container(BOX.x + 8, BOX.y, [this.nameBg, this.nameText]);

    this.arrow = scene.add.graphics();
    drawTriangle(this.arrow, 'down', THEME.accent, 3);
    this.arrow.setPosition(BOX.x + BOX.w - 12, BOX.y + BOX.h - 9);
    scene.tweens.add({ targets: this.arrow, y: this.arrow.y + 2, duration: 380, yoyo: true, repeat: -1 });

    this.choiceRoot = scene.add.container(0, 0).setVisible(false);
    this.root = scene.add.container(0, 0, [panel, this.body, this.arrow, this.nameTag, this.choiceRoot]);
    this.root.setDepth(100).setVisible(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(step: DialogueStep): void {
    this.step = step;
    this.pages = this.paginate(step.text);
    this.page = 0;
    this.startPage();
    this.hideChoices();
    this.updateNameTag(step.speaker);

    if (!this.open) {
      this.open = true;
      this.scene.tweens.killTweensOf(this.root);
      this.root.setVisible(true).setAlpha(0).setY(6);
      this.scene.tweens.add({ targets: this.root, alpha: 1, y: 0, duration: 140, ease: 'Cubic.Out' });
    }
  }

  close(): void {
    this.open = false;
    this.step = null;
    this.hideChoices();
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      y: 4,
      duration: 100,
      ease: 'Cubic.In',
      onComplete: () => this.root.setVisible(false),
    });
  }

  update(delta: number): void {
    if (!this.open || !this.step) return;

    if (this.shown < this.chars.length) {
      this.arrow.setVisible(false);
      const before = Math.floor(this.shown);
      // Velocidad del texto de los ajustes; "Instantánea" muestra la página entera sin blips.
      const cps = Settings.charsPerSecond();
      if (!Number.isFinite(cps) || Controls.consume('interact')) {
        this.shown = this.chars.length;
      } else {
        this.shown = Math.min(this.chars.length, this.shown + (cps * delta) / 1000);
        this.typeSound(before, Math.floor(this.shown));
      }
      this.body.setText(this.chars.slice(0, Math.floor(this.shown)).join(''));
      return;
    }

    const lastPage = this.page >= this.pages.length - 1;
    if (!lastPage) {
      this.arrow.setVisible(true);
      if (Controls.consume('interact')) {
        playSfx('page');
        this.page++;
        this.startPage();
      }
      return;
    }

    if (this.step.choices) {
      this.arrow.setVisible(false);
      if (!this.choicesVisible) this.showChoices(this.step.choices.map((c) => c.label));
      const n = this.step.choices.length;
      if (Controls.consume('up')) this.select((this.selected + n - 1) % n);
      if (Controls.consume('down')) this.select((this.selected + 1) % n);
      if (Controls.consume('interact')) {
        const choice = this.step.choices[this.selected];
        playSfx('select');
        Dialogue.choose(choice.index);
      }
      return;
    }

    this.arrow.setVisible(true);
    if (Controls.consume('interact')) {
      playSfx('page');
      Dialogue.advance();
    }
  }

  /** Un "blip" cada dos letras nuevas (sin contar espacios). */
  private typeSound(from: number, to: number): void {
    for (let i = from; i < to; i++) {
      if (i % 2 === 0 && this.chars[i].trim() !== '') {
        playSfx('blip');
        return;
      }
    }
  }

  private startPage(): void {
    this.chars = Array.from(this.pages[this.page] ?? '');
    this.shown = 0;
    this.body.setText('');
    this.arrow.setVisible(false);
  }

  /** Corta el texto en páginas de LINES_PER_PAGE líneas según el ancho real de la fuente. */
  private paginate(text: string): string[] {
    if (text === '') return [''];
    const lines = this.measurer.getWrappedText(text);
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
      pages.push(lines.slice(i, i + LINES_PER_PAGE).join('\n'));
    }
    return pages;
  }

  private updateNameTag(speaker: string | undefined): void {
    this.nameTag.setVisible(Boolean(speaker));
    if (!speaker) return;
    this.nameText.setText(speaker);
    const w = Math.ceil(this.nameText.width) + 12;
    this.nameBg.clear();
    drawPanel(this.nameBg, 0, -7, w, 13, { radius: 4, fill: THEME.accent, edge: THEME.panelEdge, shadow: false });
    this.nameText.setPosition(6, 0);
  }

  private showChoices(labels: string[]): void {
    this.choiceRoot.removeAll(true);
    // Una opción larga se parte en dos líneas: el cuadro nunca pasa del ancho de la caja de diálogo.
    const maxTextW = BOX.w - 24;
    this.choiceRows = [];
    let top = 5;
    const texts = labels.map((label) => {
      const t = makeText(this.scene, 16, top, label, {
        color: THEME.ink,
        lineSpacing: 1,
        wordWrap: { width: maxTextW, useAdvancedWrap: true },
      });
      this.choiceRows.push(top);
      top += Math.max(CHOICE_ROW, Math.ceil(t.height) + 3);
      return t;
    });
    const w = Math.min(BOX.w, Math.ceil(Math.max(...texts.map((t) => t.width))) + 24);
    const h = top + 4;
    const bg = this.scene.add.graphics();
    drawPanel(bg, 0, 0, w, h, { radius: 5 });
    this.cursor = this.scene.add.graphics();
    drawTriangle(this.cursor, 'right', THEME.accent, 3);
    this.choiceRoot.add([bg, ...texts, this.cursor]);

    const x = Math.max(BOX.x, BOX.x + BOX.w - w);
    const y = Math.max(2, BOX.y - h - 4);
    this.choiceRoot.setPosition(x, y + 4).setAlpha(0).setVisible(true);
    this.scene.tweens.add({ targets: this.choiceRoot, alpha: 1, y, duration: 120, ease: 'Cubic.Out' });
    this.choicesVisible = true;
    dialogueUi.choicesTop = y;
    this.select(0);
  }

  private select(i: number): void {
    if (i !== this.selected) playSfx('cursor');
    this.selected = i;
    this.cursor?.setPosition(9, (this.choiceRows[i] ?? 5 + i * CHOICE_ROW) + 6.5);
    this.choiceRoot.list.forEach((obj, idx) => {
      if (obj instanceof Phaser.GameObjects.Text) obj.setColor(idx - 1 === i ? THEME.accentCss : THEME.ink);
    });
  }

  private hideChoices(): void {
    this.choicesVisible = false;
    dialogueUi.choicesTop = null;
    this.selected = 0;
    this.cursor = null;
    this.choiceRoot.removeAll(true).setVisible(false);
  }
}
