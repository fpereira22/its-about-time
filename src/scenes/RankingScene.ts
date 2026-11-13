import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import {
  averageRating,
  latestComments,
  Ranking,
  type RankingSnapshot,
  starsText,
  topPlayers,
} from '../systems/Ranking';
import { drawPanel, drawTriangle, fitText, makeText, MEDAL_CSS, THEME } from '../ui/theme';
import { openVoteForm } from '../ui/VoteForm';
import { BaseScene } from './BaseScene';

const PANEL = { x: 10, y: 4, w: BASE_WIDTH - 20, h: 160 };
const L = PANEL.x + 12;
const R = PANEL.x + PANEL.w - 12;
const PAGES = ['Top 10 jugadores', 'Opiniones'] as const;
/** Hasta dónde pueden llegar los comentarios (abajo va la fila "Tú" y el botón de votar). */
const COMMENTS_BOTTOM = PANEL.y + PANEL.h - 16;
/** Líneas máximas de cada comentario. */
const COMMENT_LINES = 3;
const LINE_H = 9;

/** Ranking completo (top 10) y opiniones de los jugadores; E abre el formulario para votar. */
export class RankingScene extends BaseScene {
  private page = 0;
  private scroll = 0;
  private content: Phaser.GameObjects.Container | null = null;
  private snap: RankingSnapshot | null = null;
  private leaving = false;
  private closeForm: (() => void) | null = null;
  /** Lo que arma showPage (va al contenedor `content`). */
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Ranking');
    this.fixedCamera = true;
  }

  /** `page`: 0 = top 10, 1 = opiniones (cada panel del título abre la suya). */
  init(data: { page?: number }): void {
    this.page = data?.page === 1 ? 1 : 0;
  }

  create(): void {
    this.leaving = false;
    this.content = null;
    this.closeForm = null;
    this.scroll = 0;
    this.cameras.main.setBackgroundColor(THEME.darkCss);

    const panel = this.add.graphics();
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 8 });
    const help = Ranking.canSubmit ? 'A/D: PÁGINA  ·  E: VOTAR  ·  ESC: VOLVER' : 'A/D: PÁGINA  ·  ESC: VOLVER';
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 4, help, { fontFamily: FONT_HUD, fontSize: '8px', color: '#8c98b8' }).setOrigin(0.5, 1);

    // Lo guardado al tiro; la planilla actualizada cuando llegue.
    const cached = Ranking.cached;
    this.snap = cached.fetchedAt > 0 || cached.players.length > 0 || cached.comments.length > 0 ? cached : null;
    this.showPage();
    void Ranking.load(true).then((s) => {
      if (!this.sys.isActive()) return;
      this.snap = s;
      this.showPage();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.closeForm?.());
    this.setupZoom();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  override update(): void {
    if (this.leaving || this.closeForm) return;
    if (Controls.consume('menu')) {
      playSfx('cancel');
      this.leaving = true;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
      return;
    }
    if (Controls.consume('interact')) {
      this.openVote();
      return;
    }
    const step = Controls.consume('left') ? -1 : Controls.consume('right') ? 1 : 0;
    if (step !== 0) this.turnPage(step);
    const scroll = Controls.consume('up') ? -1 : Controls.consume('down') ? 1 : 0;
    if (scroll !== 0 && this.page === 1) {
      const max = Math.max(0, latestComments(this.snap?.comments ?? []).length - 1);
      const next = Phaser.Math.Clamp(this.scroll + scroll, 0, max);
      if (next !== this.scroll) {
        playSfx('cursor');
        this.scroll = next;
        this.showPage();
      }
    }
  }

  private turnPage(step: number): void {
    playSfx('cursor');
    this.page = (this.page + step + PAGES.length) % PAGES.length;
    this.scroll = 0;
    this.showPage();
  }

  private openVote(): void {
    if (!Ranking.canSubmit) {
      playSfx('error');
      return;
    }
    playSfx('select');
    this.closeForm = openVoteForm((sent) => {
      this.closeForm = null;
      if (!sent || !this.sys.isActive()) return;
      this.snap = Ranking.cached;
      this.showPage();
    });
  }

  private showPage(): void {
    this.content?.destroy();
    const objs: Phaser.GameObjects.GameObject[] = [];
    this.objs = objs;
    const text = (x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}) => {
      const t = makeText(this, x, y, value, { color: THEME.ink, fontSize: '9px', ...style });
      objs.push(t);
      return t;
    };
    const cx = BASE_WIDTH / 2;

    // Título con flechas (también se pueden tocar).
    const title = text(cx, PANEL.y + 5, PAGES[this.page], { fontSize: '11px', fontStyle: '600' }).setOrigin(0.5, 0);
    const ay = title.y + title.height / 2;
    for (const dir of [-1, 1]) {
      const g = this.add.graphics({ x: cx + dir * (title.width / 2 + 9), y: ay }).setScale(dir, 1);
      drawTriangle(g, 'right', THEME.accent, 3);
      const hit = this.add.zone(g.x, ay, 14, 14).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => !this.closeForm && this.turnPage(dir));
      objs.push(g, hit);
    }
    const line = this.add.graphics();
    line.fillStyle(THEME.panelInner, 1).fillRect(L - 2, PANEL.y + 20, PANEL.w - 20, 1);
    objs.push(line);

    if (!this.snap) {
      text(cx, PANEL.y + 70, 'Cargando ranking...', { color: THEME.inkMuted }).setOrigin(0.5);
    } else if (this.page === 0) {
      this.drawTop(text, this.snap);
    } else {
      this.drawComments(text, this.snap);
    }

    // Pie del panel: el jugador y el botón para votar.
    const me = Ranking.myScore();
    const who = Ranking.playerName ? `Tú (${Ranking.playerName})` : 'Tú (sin publicar)';
    const mine = text(L, PANEL.y + PANEL.h - 13, '', { color: THEME.inkMuted });
    fitText(mine, `${who}: ${me.score}/${me.total} · ${me.missions} misiones`, PANEL.w - 90);
    if (Ranking.canSubmit) {
      const btn = text(R, PANEL.y + PANEL.h - 13, '★ Votar el juego', { color: THEME.accentCss, fontStyle: '600' }).setOrigin(1, 0);
      btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => !this.closeForm && this.openVote());
    }
    if (this.snap?.offline) {
      text(R, PANEL.y + 7, 'sin conexión', { fontFamily: FONT_HUD, fontSize: '8px', color: '#c03a2b' }).setOrigin(1, 0);
    }

    this.content = this.add.container(0, 0, objs).setDepth(2);
  }

  private drawTop(text: TextFn, data: RankingSnapshot): void {
    const top = topPlayers(data.players);
    const head = { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.inkMuted };
    const y0 = PANEL.y + 25;
    text(L, y0, '#', head);
    text(L + 16, y0, 'JUGADOR', head);
    text(R - 64, y0, 'MISIONES', head).setOrigin(1, 0);
    text(R, y0, 'PUNTAJE', head).setOrigin(1, 0);
    if (top.length === 0) {
      const msg = data.offline ? 'Sin conexión: no se pudo leer el ranking.' : 'Aún no hay jugadores. ¡Sé el primero!';
      text(BASE_WIDTH / 2, PANEL.y + 75, msg, { color: THEME.inkMuted }).setOrigin(0.5);
      return;
    }
    const myId = Ranking.playerId;
    top.forEach((p, i) => {
      const y = y0 + 11 + i * 11;
      const isMe = p.id === myId;
      if (isMe) {
        // Franja detrás de la fila propia (entra al contenedor antes que los textos de la fila).
        const band = this.add.graphics();
        band.fillStyle(THEME.accent, 0.12).fillRect(L - 4, y - 1, R - L + 8, 11);
        this.objs.push(band);
      }
      const color = isMe ? THEME.accentCss : THEME.ink;
      text(L, y, `${i + 1}`, { color: MEDAL_CSS[i] ?? THEME.inkMuted, fontStyle: '600' });
      fitText(text(L + 16, y, '', { color, fontStyle: i < 3 || isMe ? '600' : '400' }), p.name, R - 80 - (L + 16));
      text(R - 64, y, `${p.missions}`, { color }).setOrigin(1, 0);
      const pct = p.total > 0 ? ` (${Math.round((p.score / p.total) * 100)}%)` : '';
      text(R, y, `${p.score}${pct}`, { color, fontStyle: '600' }).setOrigin(1, 0);
    });
  }

  private drawComments(text: TextFn, data: RankingSnapshot): void {
    const { avg, votes } = averageRating(data.comments);
    const y0 = PANEL.y + 25;
    if (votes === 0) {
      const msg = data.offline ? 'Sin conexión: no se pudieron leer las opiniones.' : 'Aún no hay votos. ¡Sé el primero!';
      text(BASE_WIDTH / 2, PANEL.y + 75, msg, { color: THEME.inkMuted }).setOrigin(0.5);
      return;
    }
    text(L, y0, `${starsText(avg)}  ${avg.toFixed(1)}`, { color: '#c8901c', fontSize: '10px', fontStyle: '600' });
    const votesLabel = text(R, y0 + 1, `${votes} ${votes === 1 ? 'voto' : 'votos'}`, { color: THEME.inkMuted }).setOrigin(1, 0);

    const list = latestComments(data.comments);
    if (list.length === 0) {
      text(BASE_WIDTH / 2, PANEL.y + 80, 'Nadie ha dejado comentarios todavía.', { color: THEME.inkMuted }).setOrigin(0.5);
      return;
    }
    // Uno debajo del otro mientras quepan; W/S avanza de a un comentario.
    let y = y0 + 15;
    let shown = 0;
    for (const c of list.slice(this.scroll)) {
      const body = text(L, y + LINE_H, '', { color: THEME.ink, fontSize: '8px' }).setLineSpacing(0);
      body.setWordWrapWidth(R - L);
      let lines = body.getWrappedText(`“${c.comment}”`);
      if (lines.length > COMMENT_LINES) lines = [...lines.slice(0, COMMENT_LINES - 1), `${lines[COMMENT_LINES - 1].trimEnd()}...`];
      const h = LINE_H * (1 + lines.length);
      if (shown > 0 && y + h > COMMENTS_BOTTOM) {
        body.destroy();
        this.objs.splice(this.objs.indexOf(body), 1);
        break;
      }
      body.setText(lines);
      text(L, y, starsText(c.stars), { color: '#c8901c', fontSize: '8px' });
      fitText(text(L + 34, y, '', { fontStyle: '600' }), `${c.name}${shortDate(c.date)}`, R - L - 34);
      y += h + 5;
      shown++;
    }
    if (shown < list.length) {
      const from = this.scroll + 1;
      votesLabel.setText(`${votes} votos  ·  W/S: ${from}-${from + shown - 1} de ${list.length}`);
    }
  }
}

type TextFn = (x: number, y: number, value: string, style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;

/** " · 13/11" a partir de una fecha ISO (vacío si no se entiende). */
function shortDate(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? ` · ${Number(m[2])}/${Number(m[1])}` : '';
}
