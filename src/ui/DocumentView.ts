import Phaser from 'phaser';
import { frameIndex } from '../art/characters';
import { FONT_HUD } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import { currentOutfit, lookTexture, playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { drawPanel, makeText, THEME } from './theme';

/** A la izquierda: así no tapa las opciones del diálogo (que salen a la derecha). */
const CARD = { x: 10, y: 36, w: 146, h: 84 };
const PHOTO = { x: 8, y: 25, w: 38, h: 43 };
/** Tarjeta de embarque (más ancha; los diálogos que la muestran no tienen opciones). */
const PASS = { x: 55, y: 38, w: 210, h: 78, stub: 52 };
const FIELDS_X = 52;

const FIELDS: [string, string][] = [
  ['NOMBRE', 'FELI P.'],
  ['NACIONALIDAD', 'CHILENA'],
  ['FECHA DE NACIMIENTO', '14 MAR 2003'],
  ['RUN', '21.348.077-K'],
];

interface StampDef {
  lines: [string, string];
  color: number;
  css: string;
}

const STAMPS: Record<string, StampDef> = {
  pdi: { lines: ['SALIDA · SCL', 'PDI CHILE'], color: 0x2f5fb0, css: '#2f5fb0' },
  clo: { lines: ['ENTRADA · CLO', 'MIGRACIÓN COL.'], color: 0x2f8a4a, css: '#2f8a4a' },
};

/**
 * Carnet dibujado en grande durante los controles migratorios (misión 3).
 * Lo manejan los efectos `doc` de los diálogos y se guarda solo al cerrarse el diálogo.
 */
export class DocumentView {
  private card: Phaser.GameObjects.Container | null = null;
  private focus: Phaser.GameObjects.Graphics | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    EventSystem.onScene(scene, 'document', ({ doc, id }) => {
      if (doc === 'show' && id === 'pase') this.showPass();
      else if (doc === 'show') this.show();
      else if (doc === 'focus') this.focusPhoto();
      else if (doc === 'stamp') this.stamp(id ?? 'pdi');
      else this.hide();
    });
    EventSystem.onScene(scene, 'dialogue-close', () => this.hide());
  }

  private show(): void {
    if (this.card) return;
    const scene = this.scene;
    const { w, h } = CARD;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h, { radius: 5, fill: 0xe4edf3 });
    // Fondo de seguridad: líneas onduladas tenues.
    g.lineStyle(1, 0xc8d8e6, 1);
    for (let row = 30; row < h - 4; row += 6) {
      g.beginPath();
      for (let x = 2; x <= w - 2; x += 4) {
        const y = row + Math.sin(x / 7) * 1.5;
        if (x === 2) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
    // Banda superior con la bandera.
    g.fillStyle(0x24508e, 1).fillRoundedRect(1, 1, w - 2, 15, { tl: 4, tr: 4, bl: 0, br: 0 });
    g.fillStyle(0x2f6fd0, 1).fillRect(w - 22, 4, 6, 4);
    g.fillStyle(0xffffff, 1).fillRect(w - 16, 4, 10, 4).fillRect(w - 22, 8, 16, 4);
    g.fillStyle(0xd04848, 1).fillRect(w - 22, 8, 16, 4);
    g.fillStyle(0xffffff, 1).fillRect(w - 20, 5, 2, 2);
    // Foto y firma.
    g.fillStyle(0xb8c8d8, 1).fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    g.lineStyle(1, THEME.panelEdge, 0.5).strokeRect(PHOTO.x + 0.5, PHOTO.y + 0.5, PHOTO.w - 1, PHOTO.h - 1);
    g.lineStyle(1, 0x24508e, 0.8).beginPath();
    g.moveTo(PHOTO.x + 3, h - 8);
    for (let i = 1; i <= 10; i++) g.lineTo(PHOTO.x + 3 + i * 3, h - 8 + (i % 2 ? -3 : 1));
    g.strokePath();

    const parts: Phaser.GameObjects.GameObject[] = [g];
    parts.push(makeText(scene, 6, 4, 'REPÚBLICA DE CHILE', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }));
    parts.push(makeText(scene, 6, 17, 'CÉDULA DE IDENTIDAD', { fontSize: '7px', fontStyle: '600', color: '#24508e' }));

    // La foto es el jugador sin jockey (en el carnet no se puede salir con gorro).
    const base = playerLook(currentOutfit(), false);
    const look = {
      ...base,
      hairStyle: base.hairStyle === 'cap' ? ('short' as const) : base.hairStyle,
      extras: (base.extras ?? []).filter((e) => e !== 'backpack'),
    };
    const photo = scene.add
      // Recorte de 12×13 px del cuadro (cabeza y hombros) a escala 3; la x compensa el recorte.
      .image(PHOTO.x + 1 - 2 * 3, PHOTO.y + 4, lookTexture(scene, look), frameIndex('down', 0))
      .setOrigin(0, 0)
      .setScale(3)
      .setCrop(2, 0, 12, 13);
    parts.push(photo);

    FIELDS.forEach(([label, value], i) => {
      const y = PHOTO.y - 1 + i * 13;
      parts.push(makeText(scene, FIELDS_X, y, label, { fontSize: '6px', color: THEME.inkMuted }));
      parts.push(makeText(scene, FIELDS_X, y + 5, value, { fontSize: '8px', fontStyle: '600', color: THEME.ink }));
    });

    this.focus = scene.add.graphics().setVisible(false);
    this.focus.lineStyle(2, 0xf0c030, 1).strokeRect(PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2);
    parts.push(this.focus);

    const card = scene.add.container(CARD.x, 190, parts).setDepth(90).setAngle(-3);
    this.card = card;
    scene.tweens.add({ targets: card, y: CARD.y, angle: 0, duration: 260, ease: 'Back.Out' });
  }

  /** Tarjeta de embarque: cuerpo con ruta y datos del vuelo, y talón con grupo y código de barras. */
  private showPass(): void {
    if (this.card) this.hide(true);
    const scene = this.scene;
    const { w, h, stub } = PASS;
    const main = w - stub;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h, { radius: 4, fill: 0xfbfaf4 });
    g.fillStyle(0x8a2040, 1).fillRoundedRect(1, 1, w - 2, 15, { tl: 3, tr: 3, bl: 0, br: 0 });
    // Logo: dos cerros nevados.
    g.fillStyle(0xffffff, 1).fillTriangle(5, 13, 10, 5, 15, 13).fillTriangle(11, 13, 15, 8, 19, 13);
    // Perforación entre el cuerpo y el talón.
    g.fillStyle(0xc8c0b0, 1);
    for (let y = 18; y < h - 3; y += 4) g.fillRect(main, y, 1, 2);
    // Ruta: SCL ——✈—— CLO.
    g.lineStyle(1, 0x8a2040, 1).lineBetween(46, 41, 88, 41);
    g.fillStyle(0x8a2040, 1).fillTriangle(64, 37, 64, 45, 72, 41).fillRect(60, 40, 6, 2);
    g.fillStyle(0xe9e2d2, 1).fillRect(4, 55, main - 8, 1);

    const ink = THEME.ink;
    const muted = THEME.inkMuted;
    const parts: Phaser.GameObjects.GameObject[] = [g];
    const label = (x: number, y: number, text: string): void => {
      parts.push(makeText(scene, x, y, text, { fontSize: '6px', color: muted }));
    };
    const value = (x: number, y: number, text: string, size = '8px'): Phaser.GameObjects.Text => {
      const t = makeText(scene, x, y, text, { fontFamily: FONT_HUD, fontSize: size, color: ink });
      parts.push(t);
      return t;
    };
    parts.push(makeText(scene, 23, 4, 'CORDILLERA AIR', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ffffff' }));
    parts.push(makeText(scene, w - 5, 5, 'TARJETA DE EMBARQUE', { fontSize: '6px', color: '#f0d0d8' }).setOrigin(1, 0));

    label(6, 18, 'PASAJERO');
    value(6, 23, 'FELI P.');
    value(6, 32, 'SCL', '16px');
    label(6, 48, 'SANTIAGO');
    value(94, 32, 'CLO', '16px');
    label(94, 48, 'CALI');

    const cols: [string, string][] = [
      ['VUELO', 'CA 742'],
      ['EMBARQUE', '01:10'],
      ['PUERTA', 'E4'],
      ['ASIENTO', '18A'],
    ];
    const colW = (main - 8) / cols.length;
    cols.forEach(([l, v], i) => {
      const x = 6 + i * colW;
      label(x, 58, l);
      const t = value(x, 64, v);
      // Si ya viste el cambio de puerta, la E4 está tachada y anotada a mano.
      if (l === 'PUERTA' && StoryState.hasFlag('vio_cambio')) {
        g.lineStyle(1, 0xd04848, 1).lineBetween(x - 1, 69, x + t.width + 1, 67);
        parts.push(makeText(scene, x + t.width + 3, 64, 'D6!', { fontSize: '9px', fontStyle: '600', color: '#d04848' }).setAngle(-8));
      }
    });

    // Talón.
    const sx = main + 5;
    label(sx, 18, 'GRUPO');
    value(sx, 23, '4', '16px');
    label(sx + 20, 18, 'ASIENTO');
    value(sx + 20, 26, '18A');
    for (let i = 0, x = sx; x < w - 6; i++) {
      const bw = 1 + ((i * 7) % 3 === 0 ? 1 : 0);
      if (i % 2 === 0) g.fillStyle(THEME.panelEdge, 1).fillRect(x, 46, bw, 20);
      x += bw + ((i * 5) % 4 === 0 ? 2 : 1);
    }
    label(sx, 67, 'CA742 · 18A');

    const card = scene.add.container(PASS.x, 190, parts).setDepth(90).setAngle(3);
    this.card = card;
    this.focus = null;
    scene.tweens.add({ targets: card, y: PASS.y, angle: 0, duration: 260, ease: 'Back.Out' });
  }

  /** Marca la foto (cuando el funcionario la compara con tu cara). */
  private focusPhoto(): void {
    if (!this.card) this.show();
    const focus = this.focus;
    if (!focus) return;
    focus.setVisible(true).setAlpha(1);
    this.scene.tweens.add({ targets: focus, alpha: 0.2, duration: 260, yoyo: true, repeat: 3, onComplete: () => focus.setVisible(false) });
  }

  private stamp(id: string): void {
    if (!this.card) this.show();
    const card = this.card;
    const def = STAMPS[id] ?? STAMPS.pdi;
    if (!card) return;
    const scene = this.scene;
    const g = scene.add.graphics();
    g.lineStyle(2, def.color, 1).strokeRoundedRect(-40, -12, 80, 24, 4);
    g.lineStyle(1, def.color, 1).strokeRoundedRect(-37, -9, 74, 18, 3);
    const top = makeText(scene, 0, -6, def.lines[0], { fontFamily: FONT_HUD, fontSize: '8px', color: def.css }).setOrigin(0.5, 0);
    const bottom = makeText(scene, 0, 1, def.lines[1], { fontSize: '6px', fontStyle: '600', color: def.css }).setOrigin(0.5, 0);
    const stamp = scene.add.container(CARD.w - 46, CARD.h - 22, [g, top, bottom]).setAngle(-14).setScale(2.2).setAlpha(0);
    card.add(stamp);
    scene.tweens.add({
      targets: stamp,
      scale: 1,
      alpha: 0.85,
      duration: 130,
      ease: 'Quad.In',
      onComplete: () => {
        // El golpe del timbre sacude el carnet.
        scene.tweens.add({ targets: card, y: CARD.y + 2, duration: 40, yoyo: true, ease: 'Quad.Out' });
      },
    });
  }

  private hide(immediate = false): void {
    const card = this.card;
    if (!card) return;
    this.card = null;
    this.focus = null;
    this.scene.tweens.killTweensOf(card);
    if (immediate) {
      card.destroy();
      return;
    }
    this.scene.tweens.add({
      targets: card,
      y: 190,
      angle: 4,
      duration: 200,
      ease: 'Cubic.In',
      onComplete: () => card.destroy(),
    });
  }
}
