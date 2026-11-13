import Phaser from 'phaser';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import { averageRating, latestComments, Ranking, type RankingSnapshot, starsText, topPlayers } from '../systems/Ranking';
import { drawPanel, fitText, makeText, MEDAL_CSS as MEDAL, THEME } from './theme';
const TOP = 78;
const BOTTOM = 165;
const GAP = 4;
const ROW = 7;
/** Más angosto que esto no se dibuja (el menú quedó muy ancho). */
const MIN_W = 64;

/**
 * Los dos paneles a los lados del menú del título: el top 10 (derecha) y las opiniones (izquierda).
 * Tocar uno abre la pantalla de ranking en esa página.
 */
export class TitleBoards {
  readonly container: Phaser.GameObjects.Container;
  private readonly left: Phaser.GameObjects.Container | null;
  private readonly right: Phaser.GameObjects.Container | null;
  private readonly lw: number;
  private readonly rw: number;

  constructor(
    private readonly scene: Phaser.Scene,
    menu: { x: number; width: number },
    onOpen: (page: number) => void,
  ) {
    this.container = scene.add.container(0, 0).setDepth(20);
    this.lw = menu.x - GAP - GAP;
    const rx = menu.x + menu.width + GAP;
    this.rw = BASE_WIDTH - GAP - rx;
    this.left = this.lw >= MIN_W ? this.panel(GAP, this.lw, () => onOpen(1)) : null;
    this.right = this.rw >= MIN_W ? this.panel(rx, this.rw, () => onOpen(0)) : null;
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }

  /** Dibuja lo que se sabe; `null` = todavía cargando. */
  show(s: RankingSnapshot | null): void {
    if (this.right) this.fillTop(this.right, this.rw, s);
    if (this.left) this.fillOpinions(this.left, this.lw, s);
  }

  private panel(x: number, w: number, onTap: () => void): Phaser.GameObjects.Container {
    const bg = this.scene.add.graphics();
    drawPanel(bg, 0, 0, w, BOTTOM - TOP, { radius: 5 });
    const hit = this.scene.add.zone(0, 0, w, BOTTOM - TOP).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', onTap);
    const c = this.scene.add.container(x, TOP, [bg, hit]);
    this.container.add(c);
    return c;
  }

  /** Borra lo dibujado antes (deja el fondo y la zona táctil) y pone el encabezado. */
  private reset(c: Phaser.GameObjects.Container, w: number, title: string): void {
    c.list.slice(2).forEach((o) => o.destroy());
    c.add(makeText(this.scene, w / 2, 3, title, { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.ink }).setOrigin(0.5, 0));
    const line = this.scene.add.graphics();
    line.fillStyle(THEME.panelInner, 1).fillRect(4, 12, w - 8, 1);
    c.add(line);
  }

  private text(c: Phaser.GameObjects.Container, x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    const t = makeText(this.scene, x, y, value, { fontSize: '7px', color: THEME.ink, ...style });
    c.add(t);
    return t;
  }

  private note(c: Phaser.GameObjects.Container, w: number, value: string): void {
    this.text(c, w / 2, (BOTTOM - TOP) / 2 + 5, value, { color: THEME.inkMuted, align: 'center', wordWrap: { width: w - 10 } }).setOrigin(0.5);
  }

  private fillTop(c: Phaser.GameObjects.Container, w: number, s: RankingSnapshot | null): void {
    this.reset(c, w, 'TOP 10');
    if (!s) return this.note(c, w, 'Cargando...');
    const top = topPlayers(s.players);
    if (top.length === 0) return this.note(c, w, s.offline ? 'Sin conexión' : 'Nadie todavía.\n¡Sé el primero!');
    const myId = Ranking.playerId;
    top.forEach((p, i) => {
      const y = 15 + i * ROW;
      const isMe = p.id === myId;
      if (isMe) {
        const band = this.scene.add.graphics();
        band.fillStyle(THEME.accent, 0.14).fillRect(2, y, w - 4, ROW);
        c.add(band);
      }
      this.text(c, 5, y, `${i + 1}`, { color: MEDAL[i] ?? THEME.inkMuted, fontStyle: '600' });
      const score = this.text(c, w - 5, y, `${p.score}`, { fontStyle: '600', color: isMe ? THEME.accentCss : THEME.ink }).setOrigin(1, 0);
      const name = this.text(c, 15, y, '', { color: isMe ? THEME.accentCss : THEME.ink });
      fitText(name, p.name, w - 15 - score.width - 8);
    });
  }

  private fillOpinions(c: Phaser.GameObjects.Container, w: number, s: RankingSnapshot | null): void {
    this.reset(c, w, 'OPINIONES');
    if (!s) return this.note(c, w, 'Cargando...');
    const { avg, votes } = averageRating(s.comments);
    if (votes === 0) return this.note(c, w, s.offline ? 'Sin conexión' : 'Aún no hay votos.\n¡Vota el juego!');
    this.text(c, w / 2, 15, starsText(avg), { fontSize: '10px', color: MEDAL[0] }).setOrigin(0.5, 0);
    this.text(c, w / 2, 27, `${avg.toFixed(1)} · ${votes} ${votes === 1 ? 'voto' : 'votos'}`, { color: THEME.inkMuted }).setOrigin(0.5, 0);

    const last = latestComments(s.comments)[0];
    if (!last) return;
    const by = this.text(c, w - 5, BOTTOM - TOP - 10, '', { color: THEME.inkMuted }).setOrigin(1, 0);
    fitText(by, `— ${last.name}`, w - 10);
    const body = this.text(c, 5, 38, '', { color: THEME.ink });
    body.setWordWrapWidth(w - 10);
    const maxLines = Math.floor((BOTTOM - TOP - 10 - 38 - 2) / 8);
    const lines = body.getWrappedText(`“${last.comment}”`);
    body.setLineSpacing(0).setText(lines.length > maxLines ? [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].trimEnd()}...”`] : lines);
  }
}
