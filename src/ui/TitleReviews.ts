import Phaser from 'phaser';
import { BASE_WIDTH } from '../config/display';
import { averageRating, latestComments, type RankingSnapshot, starsText } from '../systems/Ranking';
import { Settings } from '../systems/Settings';
import { fitText, makeText } from './theme';

/** Franja vertical donde aparecen (bajo el logo, sobre el pie). */
const TOP = 80;
const BOTTOM = 164;
const GAP = 6;
/** Columna más angosta que esto no se usa (el menú quedó muy ancho). */
const MIN_W = 64;
const MAX_W = 112;
const PAD = 5;
const MAX_LINES = 4;
const LINE_H = 8;
/** Cuántos comentarios recientes rotan. */
const MAX_COMMENTS = 8;

const FADE_IN = 700;
const HOLD = 4600;
const FADE_OUT = 600;
const PAUSE = 700;

interface Review {
  stars: string;
  body: string;
  by: string;
}

/**
 * Reseñas que aparecen y desaparecen, translúcidas, a los lados del menú del título: primero el
 * promedio de estrellas y luego los comentarios más nuevos, una a la vez y alternando lado.
 * Tocar una abre las opiniones. Se apagan en Ajustes ("Reseñas").
 */
export class TitleReviews {
  private reviews: Review[] = [];
  private index = 0;
  private side = 0;
  private current: Phaser.GameObjects.Container | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private visible = true;
  private readonly columns: { x: number; w: number }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    menu: { x: number; width: number },
    private readonly onOpen: () => void,
  ) {
    const lw = menu.x - GAP * 2;
    const rx = menu.x + menu.width + GAP;
    const rw = BASE_WIDTH - GAP - rx;
    if (lw >= MIN_W) this.columns.push({ x: GAP, w: lw });
    if (rw >= MIN_W) this.columns.push({ x: rx, w: rw });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop());
  }

  /** Lo que se sabe de la planilla; `null` = todavía cargando (no muestra nada). */
  show(s: RankingSnapshot | null): void {
    this.reviews = s ? buildReviews(s) : [];
    if (this.index >= this.reviews.length) this.index = 0;
    if (!this.current && !this.timer) this.next();
  }

  /** Lo oculta con el menú (submenús, ajustes). Al volver respeta el ajuste. */
  setVisible(v: boolean): void {
    this.visible = v;
    if (!this.enabled) return this.stop(true);
    if (!this.current && !this.timer) this.next();
  }

  private get enabled(): boolean {
    return this.visible && Settings.get('titleReviews');
  }

  private stop(fade = false): void {
    this.timer?.remove();
    this.timer = null;
    const c = this.current;
    this.current = null;
    if (!c) return;
    this.scene.tweens.killTweensOf(c);
    if (fade && c.active) this.scene.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
    else c.destroy();
  }

  private next(): void {
    this.timer = null;
    if (!this.enabled || this.reviews.length === 0 || this.columns.length === 0) return;
    const review = this.reviews[this.index % this.reviews.length];
    this.index = (this.index + 1) % this.reviews.length;
    const col = this.columns[this.side % this.columns.length];
    this.side++;
    const bubble = this.bubble(review, col);
    this.current = bubble;
    const y = bubble.y;
    bubble.setAlpha(0).setY(y + 6);
    this.scene.tweens.chain({
      targets: bubble,
      tweens: [
        { alpha: 1, y, duration: FADE_IN, ease: 'Sine.Out' },
        { alpha: 0, y: y - 5, duration: FADE_OUT, delay: HOLD, ease: 'Sine.In' },
      ],
      onComplete: () => {
        if (this.current !== bubble) return;
        bubble.destroy();
        this.current = null;
        this.timer = this.scene.time.delayedCall(PAUSE, () => this.next());
      },
    });
  }

  private bubble(r: Review, col: { x: number; w: number }): Phaser.GameObjects.Container {
    const w = Math.min(MAX_W, col.w);
    const inner = w - PAD * 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    let y = PAD;
    const stars = makeText(this.scene, w / 2, y, r.stars, { fontSize: '9px', color: '#f0d048' }).setOrigin(0.5, 0);
    parts.push(stars);
    y += 11;
    if (r.body) {
      const body = makeText(this.scene, PAD, y, '', { fontSize: '7px', color: '#eef2fa', wordWrap: { width: inner } });
      const lines = body.getWrappedText(r.body);
      body.setLineSpacing(0).setText(lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES - 1), `${lines[MAX_LINES - 1].trimEnd()}...”`] : lines);
      parts.push(body);
      y += Math.min(lines.length, MAX_LINES) * LINE_H + 2;
    }
    const by = makeText(this.scene, r.body ? w - PAD : w / 2, y, '', { fontSize: '7px', color: '#aab4cc' }).setOrigin(r.body ? 1 : 0.5, 0);
    fitText(by, r.by, inner);
    parts.push(by);
    const h = y + LINE_H + PAD;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d1424, 0.5).fillRoundedRect(0, 0, w, h, 5);
    bg.lineStyle(1, 0xffffff, 0.18).strokeRoundedRect(0.5, 0.5, w - 1, h - 1, 5);
    const hit = this.scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.onOpen());

    // Centrada en su columna, a una altura al azar dentro de la franja.
    const x = Math.round(col.x + (col.w - w) / 2);
    const top = Math.round(Phaser.Math.Between(TOP, Math.max(TOP, BOTTOM - h)));
    return this.scene.add.container(x, top, [bg, hit, ...parts]).setDepth(20);
  }
}

/** Primero el promedio; después los comentarios más nuevos. */
function buildReviews(s: RankingSnapshot): Review[] {
  const { avg, votes } = averageRating(s.comments);
  if (votes === 0) return [];
  const out: Review[] = [{ stars: starsText(avg), body: '', by: `${avg.toFixed(1)} · ${votes} ${votes === 1 ? 'voto' : 'votos'}` }];
  for (const c of latestComments(s.comments).slice(0, MAX_COMMENTS)) {
    out.push({ stars: starsText(c.stars), body: `“${c.comment}”`, by: `— ${c.name}` });
  }
  return out;
}
