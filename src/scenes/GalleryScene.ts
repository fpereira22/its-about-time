import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { DIARY, MINIGAMES, minigameId, type MinigameEntry } from '../data/gallery';
import { Content } from '../systems/Content';
import { Controls } from '../systems/Controls';
import { Gallery } from '../systems/Gallery';
import { getMission, missionFullLabel, missionLabel, MISSIONS } from '../systems/Mission';
import { Records } from '../systems/Records';
import { StoryState } from '../systems/StoryState';
import { drawPanel, drawTriangle, fitText, makeText, THEME } from '../ui/theme';
import { Vineta, vinetaIds } from '../ui/Vineta';
import { BaseScene } from './BaseScene';

const PANEL = { x: 10, y: 4, w: BASE_WIDTH - 20, h: 160 };
const LEFT = PANEL.x + 10;
const LIST_Y = PANEL.y + 30;
const ROW = 11;
const VISIBLE = 10;
/** Ancho de la lista; el resto del panel es el detalle (diario). */
const LIST_W = 124;
const TABS = ['Diario', 'Viñetas', 'Minijuegos'] as const;

/** Una fila de la lista de la pestaña actual. */
interface Item {
  label: string;
  /** Texto chico a la derecha (misión, estado). */
  hint?: string;
  /** Todavía no se desbloquea: se ve como "???" y no se puede abrir. */
  locked?: boolean;
  /** Lo que muestra el detalle de la derecha (solo el diario). */
  detail?: string;
  open?: () => void;
}

/**
 * Galería (Progreso → E): el diario de cada misión completada, las viñetas que ya viste (para volver a mirarlas)
 * y los minijuegos que ya jugaste (para repetirlos sueltos, sin tocar la partida).
 * A/D: pestaña · W/S: elegir · E: ver o jugar · Esc: volver.
 */
export class GalleryScene extends BaseScene {
  private tab = 0;
  private cursor = [0, 0, 0];
  private scroll = [0, 0, 0];
  private content: Phaser.GameObjects.Container | null = null;
  private leaving = false;
  private vineta!: Vineta;
  /** Mientras se juega un minijuego: esta escena duerme y no recibe entrada. */
  private playing = false;

  constructor() {
    super('Gallery');
    this.fixedCamera = true;
  }

  create(): void {
    this.leaving = false;
    this.playing = false;
    this.content = null;
    this.cameras.main.setBackgroundColor(THEME.darkCss);
    drawPanel(this.add.graphics(), PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 8 });
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 4, 'A/D: PESTAÑA  ·  W/S: ELEGIR  ·  E: VER O JUGAR  ·  ESC: VOLVER', {
      fontFamily: FONT_HUD,
      fontSize: '8px',
      color: '#8c98b8',
    }).setOrigin(0.5, 1);
    this.vineta = new Vineta(this, { standalone: true });
    // Las viñetas llegan aparte (ver Content): si todavía no están, la pestaña se arma al llegar.
    if (!Content.ready) void Content.load().then(() => this.sys.isActive() && this.showTab());
    this.showTab();
    this.setupZoom();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  override update(): void {
    if (this.leaving || this.playing) return;
    if (this.vineta.isOpen) {
      if (Controls.consume('menu') || Controls.consume('interact')) this.vineta.hide();
      return;
    }
    if (Controls.consume('menu')) {
      playSfx('cancel');
      this.leaving = true;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Progress'));
      return;
    }
    const step = Controls.consume('left') ? -1 : Controls.consume('right') ? 1 : 0;
    if (step !== 0) {
      playSfx('cursor');
      this.tab = (this.tab + step + TABS.length) % TABS.length;
      this.showTab();
      return;
    }
    const items = this.items();
    const move = Controls.consume('up') ? -1 : Controls.consume('down') ? 1 : 0;
    if (move !== 0 && items.length > 0) {
      const i = Phaser.Math.Clamp(this.cursor[this.tab] + move, 0, items.length - 1);
      if (i !== this.cursor[this.tab]) {
        playSfx('cursor');
        this.cursor[this.tab] = i;
        const top = this.scroll[this.tab];
        if (i < top) this.scroll[this.tab] = i;
        else if (i >= top + VISIBLE) this.scroll[this.tab] = i - VISIBLE + 1;
        this.showTab();
      }
    }
    if (Controls.consume('interact')) {
      const item = items[this.cursor[this.tab]];
      if (!item?.open || item.locked) return playSfx('error');
      item.open();
    }
  }

  // --------------------------------------------------------------------- contenido de cada pestaña

  private items(): Item[] {
    if (this.tab === 0) return this.diaryItems();
    if (this.tab === 1) return this.vinetaItems();
    return this.minigameItems();
  }

  private diaryItems(): Item[] {
    return MISSIONS.map((m): Item => {
      const done = Records.isCompleted(m.id);
      return done
        ? { label: missionFullLabel(m), detail: DIARY[m.id] ?? 'Sin notas todavía.' }
        : { label: `${missionLabel(m)}: ???`, locked: true, detail: 'Todavía no completas esta misión. Cuando la termines, aquí queda lo que pasó.' };
    });
  }

  private vinetaItems(): Item[] {
    const known = new Set(vinetaIds());
    return Gallery.vinetas
      .filter((v) => known.size === 0 || known.has(v.id))
      .map(
        (v, i): Item => ({
          label: `${i + 1}. ${prettify(v.id)}`,
          hint: v.mission ? missionLabel(getMission(v.mission)) : '',
          open: () => {
            playSfx('select');
            this.vineta.show(v.id);
          },
        }),
      );
  }

  private minigameItems(): Item[] {
    return MINIGAMES.map((g): Item => {
      const played = Gallery.hasPlayed(minigameId(g.scene, g.data));
      return played
        ? { label: g.label, hint: missionLabel(getMission(g.mission)), open: () => this.play(g) }
        : { label: '???', hint: missionLabel(getMission(g.mission)), locked: true };
    });
  }

  // --------------------------------------------------------------------- dibujo

  private showTab(): void {
    this.content?.destroy();
    const objs: Phaser.GameObjects.GameObject[] = [];
    const text = (x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text => {
      const t = makeText(this, x, y, value, { color: THEME.ink, fontSize: '9px', ...style });
      objs.push(t);
      return t;
    };

    // Pestañas.
    const slot = (PANEL.w - 20) / TABS.length;
    TABS.forEach((name, i) => {
      const cx = PANEL.x + 10 + slot * i + slot / 2;
      const on = i === this.tab;
      text(cx, PANEL.y + 6, name, { fontSize: '10px', fontStyle: '600', color: on ? THEME.accentCss : THEME.inkMuted }).setOrigin(0.5, 0);
      if (on) {
        const g = this.add.graphics().fillStyle(THEME.accent, 1).fillRect(cx - slot / 2 + 8, PANEL.y + 20, slot - 16, 2);
        objs.push(g);
      }
    });

    const items = this.items();
    const cursor = this.cursor[this.tab];
    const top = this.scroll[this.tab];
    if (items.length === 0) {
      const msg = this.tab === 1 ? 'Todavía no has visto ninguna viñeta. Aparecen aquí a medida que juegas.' : 'Nada por ahora.';
      text(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2 - 6, msg, { color: THEME.inkMuted, align: 'center', wordWrap: { width: PANEL.w - 60 } }).setOrigin(0.5);
    }

    const wide = this.tab !== 0;
    const listW = wide ? PANEL.w - 30 : LIST_W;
    items.slice(top, top + VISIBLE).forEach((item, k) => {
      const i = top + k;
      const y = LIST_Y + k * ROW;
      const active = i === cursor;
      const color = item.locked ? THEME.inkMuted : active ? THEME.accentCss : THEME.ink;
      if (active) {
        const g = this.add.graphics();
        drawTriangle(g, 'right', THEME.accent, 3);
        g.setPosition(LEFT - 1, y + 6);
        objs.push(g);
      }
      const label = text(LEFT + 7, y, '', { color });
      fitText(label, item.label, listW - (item.hint ? 56 : 8));
      if (item.hint) text(LEFT + listW, y + 1, item.hint, { fontSize: '8px', color: THEME.inkMuted }).setOrigin(1, 0);
    });
    if (items.length > VISIBLE) {
      text(PANEL.x + PANEL.w - 12, PANEL.y + PANEL.h - 6, `${cursor + 1}/${items.length}`, { fontSize: '8px', color: THEME.inkMuted }).setOrigin(1, 1);
    }

    // Pestaña del diario: el resumen de la misión elegida, a la derecha.
    if (this.tab === 0) {
      const sel = items[cursor];
      const line = this.add.graphics().fillStyle(THEME.panelInner, 1).fillRect(LEFT + LIST_W + 8, LIST_Y, 1, VISIBLE * ROW - 3);
      objs.push(line);
      if (sel?.detail) text(LEFT + LIST_W + 18, LIST_Y, sel.detail, { color: sel.locked ? THEME.inkMuted : THEME.ink, wordWrap: { width: PANEL.w - LIST_W - 50 }, lineSpacing: 2 });
    }
    // Pie de la pestaña de viñetas: cuántas de todas.
    if (this.tab === 1 && items.length > 0) {
      const total = vinetaIds().length;
      if (total > 0) text(LEFT, PANEL.y + PANEL.h - 6, `${items.length} vistas de ${total}`, { fontSize: '8px', color: THEME.inkMuted }).setOrigin(0, 1);
    }
    if (this.tab === 2) {
      const done = MINIGAMES.filter((g) => Gallery.hasPlayed(minigameId(g.scene, g.data))).length;
      text(LEFT, PANEL.y + PANEL.h - 6, `${done} jugados de ${MINIGAMES.length}`, { fontSize: '8px', color: THEME.inkMuted }).setOrigin(0, 1);
    }

    this.content = this.add.container(0, 0, objs).setDepth(2);
  }

  // --------------------------------------------------------------------- minijuegos sueltos

  /** Abre el minijuego sin tocar la partida (sus stats y flags de misión no cambian); al terminar vuelve a la galería. */
  private play(g: MinigameEntry): void {
    if (this.playing) return;
    playSfx('select');
    const open = (): void => {
      this.playing = true;
      // Algunos minijuegos mueven el reloj o ponen flags en la partida: se apaga el guardado y se restaura al volver.
      const before = StoryState.snapshot();
      StoryState.noSave = true;
      this.scene.launch(g.scene, {
        ...g.data,
        done: () => {
          StoryState.restore(before);
          StoryState.noSave = false;
          this.scene.stop(g.scene);
          this.playing = false;
          this.scene.wake();
          Controls.reset();
          this.cameras.main.fadeIn(250, 0, 0, 0);
          playMusic('title');
        },
      });
      this.scene.sleep();
    };
    if (Content.ready) open();
    else void Content.load().then(open);
  }
}

/** "m7_depa_ventana" → "Depa ventana": el id de la viñeta sin el prefijo de misión y con espacios. */
export function prettify(id: string): string {
  const words = id.replace(/^m\d+_/, '').replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
