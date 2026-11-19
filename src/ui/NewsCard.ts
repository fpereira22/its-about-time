import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import type { NewsView } from '../systems/News';
import { makeText } from './theme';

const MAX_W = 116;
const PAD = 6;
const BOTTOM = BASE_HEIGHT - 18;
/** Lo más arriba que llega (bajo el logo y el eslogan, donde empiezan también las reseñas). */
const TOP = 80;
const LINE_H = 8;
const EDGE = 4;
const GOLD = 0xf0d048;
/** Tiempo a pantalla: lo que toma leerlo (más líneas, más rato). */
const HOLD_BASE = 5000;
const HOLD_PER_ITEM = 1500;

/**
 * Aviso de novedades del título: una tarjeta translúcida que entra por el lado, se queda lo que toma
 * leerla (una raya fina cuenta el tiempo) y se va sola. Tocarla la cierra antes. Va bajo el menú
 * (depth 19) y en la columna libre al costado, para no tapar nada.
 */
export class NewsCard {
  private readonly root: Phaser.GameObjects.Container;
  private closed = false;

  /** `area`: franja libre donde cabe la tarjeta (x y ancho). `onClose` avisa cuando se va (sola o tocada). */
  constructor(
    private readonly scene: Phaser.Scene,
    view: NewsView,
    area: { x: number; width: number },
    private readonly onClose: () => void,
  ) {
    const w = Math.round(Math.min(MAX_W, Math.max(80, area.width)));
    const inner = w - PAD * 2 - 2;
    const parts: Phaser.GameObjects.GameObject[] = [];

    let y = PAD - 1;
    parts.push(makeText(scene, PAD + 2, y, 'NOVEDADES', { fontFamily: FONT_HUD, fontSize: '7px', color: '#f0d048' }));
    parts.push(makeText(scene, w - PAD, y, shortDate(view.date), { fontFamily: FONT_HUD, fontSize: '7px', color: '#7f8aa8' }).setOrigin(1, 0));
    y += 12;
    // Si no caben todas (columna angosta), se queda con las primeras: nunca sube hasta el logo.
    const maxBottom = BOTTOM - TOP;
    for (const item of view.items) {
      const bullet = makeText(scene, PAD + 2, y, '•', { fontSize: '7px', color: '#f0d048' });
      const line = makeText(scene, PAD + 8, y, item, { fontSize: '7px', color: '#d8e0f0', wordWrap: { width: inner - 6 } }).setLineSpacing(0);
      const next = y + Math.max(1, line.getWrappedText(item).length) * LINE_H + 2;
      if (next + PAD + 1 > maxBottom && parts.length > 2) {
        bullet.destroy();
        line.destroy();
        break;
      }
      parts.push(bullet, line);
      y = next;
    }
    const h = Math.round(y + PAD + 1);
    const hold = Math.min(12000, HOLD_BASE + HOLD_PER_ITEM * view.items.length);

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.18).fillRoundedRect(1, 2, w, h, 6);
    bg.fillStyle(0x0d1424, 0.86).fillRoundedRect(0, 0, w, h, 6);
    bg.lineStyle(1, GOLD, 0.45).strokeRoundedRect(0.5, 0.5, w - 1, h - 1, 6);
    bg.fillStyle(GOLD, 1).fillRoundedRect(0, 0, 3, h, { tl: 6, bl: 6, tr: 0, br: 0 });
    // Cuenta regresiva: una raya fina abajo que se va achicando.
    const bar = scene.add.rectangle(PAD, h - 3, w - PAD * 2, 1, GOLD, 0.6).setOrigin(0, 0.5);
    const hit = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.close());

    // Centrada en su franja, apoyada sobre el pie.
    const x = Math.round(Phaser.Math.Clamp(area.x + (area.width - w) / 2, EDGE, BASE_WIDTH - w - EDGE));
    const fromRight = x + w / 2 > BASE_WIDTH / 2;
    this.root = scene.add.container(x + (fromRight ? 16 : -16), BOTTOM - h, [bg, hit, ...parts, bar]).setDepth(19).setAlpha(0);
    scene.tweens.add({ targets: this.root, x, alpha: 1, duration: 420, ease: 'Cubic.Out' });
    scene.tweens.add({ targets: bar, scaleX: 0, duration: hold, ease: 'Linear', onComplete: () => this.close() });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      y: this.root.y + 4,
      duration: 360,
      ease: 'Sine.In',
      onComplete: () => this.root.destroy(),
    });
    this.onClose();
  }

  private destroy(): void {
    this.closed = true;
    this.root.destroy();
  }
}

/** "2026-11-19" → "19/11". */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return d && m ? `${d}/${m}` : iso;
}
