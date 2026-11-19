import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls, keyLabel } from '../systems/Controls';
import { REBINDABLE, Settings, TEXT_SPEEDS, VOLUME_STEPS, type RebindableAction } from '../systems/Settings';
import { TouchControls } from '../systems/TouchControls';
import { openBugForm } from './BugForm';
import { openCodeForm } from './VoteForm';
import { drawPanel, drawTriangle, makeText, THEME } from './theme';

/** Una fila del menú: volumen (barra), opción (texto que se cambia con A/D), acción o tecla redefinible. */
interface Row {
  label: string;
  kind: 'volume' | 'choice' | 'action' | 'key';
  /** Volumen 0..VOLUME_STEPS o texto de la opción. */
  value?: () => number | string;
  /** A/D (-1 / +1) y E (+1). */
  change: (dir: 1 | -1) => void;
  /** Acción que no cierra el menú (abre algo encima). Sin esto, una acción es "Volver". */
  run?: () => void;
  /** Solo en filas `key`: la acción cuya tecla se cambia. */
  action?: RebindableAction;
}

/** Una página del menú: la principal, Accesibilidad, Teclas... Esc o "Volver" vuelven a la de antes. */
interface Page {
  title: string;
  rows: Row[];
  rowH: number;
  /** Texto de ayuda de abajo (por defecto, los controles del menú). */
  foot?: string;
}

const KEY_LABELS: Record<RebindableAction, string> = {
  up: 'Arriba',
  down: 'Abajo',
  left: 'Izquierda',
  right: 'Derecha',
  interact: 'Hablar / aceptar',
  inventory: 'Mochila',
  phone: 'Celular',
  toggleView: 'Cambiar vista',
  trick: 'Truco (fútbol)',
};

const W = 216;
const ROW = 14;
const HEAD = 22;
const FOOT = 16;
const SEGMENT = 6;
/** Centro horizontal de la columna de valores, desde el borde izquierdo del panel. */
const VALUE_CX = 150;
const ARROW_GAP = 42;

/**
 * Menú de ajustes (título y pausa): sonido, velocidad del texto, accesibilidad (texto grande, reducir
 * efectos, tutoriales, controles táctiles y teclas), privacidad y reporte de problemas. Los cambios se
 * aplican y guardan al instante (src/systems/Settings.ts).
 * W/S: fila · A/D: cambiar · E: cambiar o entrar · Esc: volver.
 */
export class SettingsPanel {
  private readonly root: Phaser.GameObjects.Container;
  /** Páginas abiertas: la última es la que se ve. */
  private readonly stack: Page[] = [];
  private selected = 0;
  private closed = false;
  /** Formulario HTML abierto encima (código de jugador, reporte): el menú no recibe teclas. */
  private closeForm: (() => void) | null = null;
  /** Se está esperando la tecla nueva de esta acción (página Teclas). */
  private capturing: RebindableAction | null = null;
  private stopCapture: (() => void) | null = null;
  private note = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: { depth: number; onClose: () => void },
  ) {
    this.stack.push(this.mainPage());
    this.root = scene.add.container(0, 0).setDepth(opts.depth);
    this.render();
    this.root.setAlpha(0).setY(4);
    scene.tweens.add({ targets: this.root, alpha: 1, y: 0, duration: 120, ease: 'Cubic.Out' });
  }

  private get page(): Page {
    return this.stack[this.stack.length - 1];
  }

  private get rows(): Row[] {
    return this.page.rows;
  }

  update(): void {
    if (this.closed || this.closeForm || this.capturing) return;
    if (Controls.consume('menu')) return this.back();
    const n = this.rows.length;
    if (Controls.consume('up')) this.move((this.selected + n - 1) % n);
    if (Controls.consume('down')) this.move((this.selected + 1) % n);
    const row = this.rows[this.selected];
    const left = Controls.consume('left');
    const right = Controls.consume('right');
    if ((row.kind === 'volume' || row.kind === 'choice') && (left || right)) this.apply(row, right ? 1 : -1);
    if (Controls.consume('interact')) {
      if (row.kind === 'action') return row.run ? row.run() : this.back();
      if (row.kind === 'key') return this.listenForKey(row);
      this.apply(row, 1);
    }
  }

  destroy(): void {
    this.closed = true;
    this.stopCapture?.();
    this.closeForm?.();
    this.root.destroy();
  }

  /** Vuelve a la página anterior; desde la principal, cierra el menú. */
  private back(): void {
    if (this.stack.length <= 1) return this.close();
    playSfx('cancel');
    this.stack.pop();
    this.selected = 0;
    this.note = '';
    this.render();
  }

  private open(page: Page): void {
    playSfx('select');
    this.stack.push(page);
    this.selected = 0;
    this.note = '';
    this.render();
  }

  private close(): void {
    playSfx('cancel');
    this.destroy();
    this.opts.onClose();
  }

  private move(i: number): void {
    playSfx('cursor');
    this.selected = i;
    this.note = '';
    this.render();
  }

  private apply(row: Row, dir: 1 | -1): void {
    const before = row.value?.();
    row.change(dir);
    const after = row.value?.();
    // Los efectos suenan después del cambio: así se escucha el volumen nuevo.
    playSfx(before === after ? 'error' : 'cursor');
    this.render();
  }

  /** Espera la próxima tecla y se la asigna a la acción de la fila. */
  private listenForKey(row: Row): void {
    const action = row.action;
    if (!action) return;
    playSfx('select');
    this.capturing = action;
    this.note = 'Pulsa la tecla nueva · Esc: cancelar';
    const onKey = (e: KeyboardEvent): void => {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.type !== 'keydown' || e.repeat) return;
      if (e.code === 'Escape') {
        playSfx('cancel');
        return finish('');
      }
      if (!Settings.setKey(action, e.code)) {
        playSfx('error');
        this.note = 'Esa tecla no se puede usar. Prueba otra.';
        return this.render();
      }
      playSfx('select');
      finish('');
    };
    const finish = (note: string): void => {
      this.stopCapture?.();
      this.note = note;
      this.render();
    };
    this.stopCapture = () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      this.stopCapture = null;
      this.capturing = null;
      Controls.reset();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    this.render();
  }

  /** Abre un formulario HTML encima: el menú se calla hasta que se cierre. */
  private openForm(open: (onClose: () => void) => () => void): void {
    playSfx('select');
    this.closeForm = open(() => {
      this.closeForm = null;
    });
  }

  private mainPage(): Page {
    const volume = (key: 'music' | 'sfx') => (dir: 1 | -1) => Settings.set(key, Settings.get(key) + dir);
    const toggle = (key: 'titleReviews' | 'usageStats') => () => Settings.set(key, !Settings.get(key));
    const action = (label: string, run?: () => void): Row => ({ label, kind: 'action', change: () => undefined, run });
    return {
      title: 'AJUSTES',
      rowH: ROW,
      rows: [
        { label: 'Música', kind: 'volume', value: () => Settings.get('music'), change: volume('music') },
        { label: 'Efectos', kind: 'volume', value: () => Settings.get('sfx'), change: volume('sfx') },
        {
          label: 'Sonido',
          kind: 'choice',
          value: () => (Settings.get('muted') ? 'Silenciado' : 'Activado'),
          change: () => Settings.set('muted', !Settings.get('muted')),
        },
        {
          label: 'Texto',
          kind: 'choice',
          value: () => Settings.textSpeedName(),
          change: (dir) => {
            const i = TEXT_SPEEDS.indexOf(Settings.get('textSpeed'));
            Settings.set('textSpeed', TEXT_SPEEDS[(i + dir + TEXT_SPEEDS.length) % TEXT_SPEEDS.length]);
          },
        },
        action('Accesibilidad  >', () => this.open(this.accessPage())),
        {
          label: 'Reseñas',
          kind: 'choice',
          value: () => (Settings.get('titleReviews') ? 'Visibles' : 'Ocultas'),
          change: toggle('titleReviews'),
        },
        {
          label: 'Datos de uso',
          kind: 'choice',
          value: () => (Settings.get('usageStats') ? 'Enviar' : 'No enviar'),
          change: toggle('usageStats'),
        },
        action('Código de jugador', () => this.openForm(openCodeForm)),
        action('Reportar un problema', () => this.openForm(openBugForm)),
        action('Volver'),
      ],
    };
  }

  private accessPage(): Page {
    const yesNo = (key: 'bigText' | 'reduceEffects' | 'tutorials') => ({
      kind: 'choice' as const,
      value: () => (Settings.get(key) ? 'Sí' : 'No'),
      change: () => Settings.set(key, !Settings.get(key)),
    });
    return {
      title: 'ACCESIBILIDAD',
      rowH: ROW,
      rows: [
        { label: 'Texto grande', ...yesNo('bigText') },
        { label: 'Reducir efectos', ...yesNo('reduceEffects') },
        { label: 'Tutoriales', ...yesNo('tutorials') },
        {
          // Solo Auto / Siempre: "Nunca" en un celular dejaría al jugador sin forma de moverse.
          // (El modo admin conserva las tres opciones.)
          label: 'Controles táctiles',
          kind: 'choice',
          value: () => (TouchControls.currentMode === 'on' ? 'Siempre' : TouchControls.currentMode === 'off' ? 'Nunca' : 'Auto'),
          change: () => TouchControls.setMode(TouchControls.currentMode === 'on' ? 'auto' : 'on'),
        },
        { label: 'Teclas  >', kind: 'action', change: () => undefined, run: () => this.open(this.keysPage()) },
        { label: 'Volver', kind: 'action', change: () => undefined },
      ],
    };
  }

  private keysPage(): Page {
    const rows: Row[] = REBINDABLE.map((action) => ({
      label: KEY_LABELS[action],
      kind: 'key' as const,
      action,
      value: () => (this.capturing === action ? '...' : keyLabel(Settings.keyFor(action))),
      change: () => undefined,
    }));
    rows.push({
      label: 'Restablecer',
      kind: 'action',
      change: () => undefined,
      run: () => {
        playSfx('select');
        Settings.resetKeys();
        this.note = 'Teclas de fábrica.';
        this.render();
      },
    });
    rows.push({ label: 'Volver', kind: 'action', change: () => undefined });
    return { title: 'TECLAS', rowH: 12, rows, foot: 'E: cambiar la tecla · Esc: volver' };
  }

  private render(): void {
    this.root.removeAll(true);
    const rowH = this.page.rowH;
    const h = HEAD + this.rows.length * rowH + FOOT;
    const x = Math.round((BASE_WIDTH - W) / 2);
    const y = Math.round((BASE_HEIGHT - h) / 2);
    const g = this.scene.add.graphics();
    drawPanel(g, x, y, W, h, { radius: 7 });
    this.root.add(g);
    this.root.add(makeText(this.scene, x + 12, y + 8, this.page.title, { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.accentCss }));

    this.rows.forEach((row, i) => {
      const ry = y + HEAD + i * rowH;
      const active = i === this.selected;
      const color = active ? THEME.accentCss : THEME.ink;
      this.root.add(makeText(this.scene, x + 20, ry, row.label, { color }));
      if (active) {
        const cursor = this.scene.add.graphics();
        drawTriangle(cursor, 'right', THEME.accent, 3);
        cursor.setPosition(x + 12, ry + 6);
        this.root.add(cursor);
      }
      const cx = x + VALUE_CX;
      const value = row.value?.();
      if (typeof value === 'number') this.drawBar(cx, ry + 2, value, active);
      else if (value !== undefined) this.root.add(makeText(this.scene, cx, ry, value, { color }).setOrigin(0.5, 0));
      if (active && (row.kind === 'volume' || row.kind === 'choice')) this.drawArrows(cx, ry + 6);
    });

    this.root.add(
      makeText(this.scene, x + W / 2, y + h - 5, this.note || this.page.foot || 'A/D: cambiar · E: elegir · Esc: volver', {
        fontFamily: FONT_HUD,
        fontSize: '8px',
        color: THEME.inkMuted,
      }).setOrigin(0.5, 1),
    );
  }

  /** Barra de VOLUME_STEPS segmentos centrada en `cx`. */
  private drawBar(cx: number, y: number, value: number, active: boolean): void {
    const g = this.scene.add.graphics();
    const w = VOLUME_STEPS * SEGMENT;
    const x0 = Math.round(cx - w / 2);
    for (let i = 0; i < VOLUME_STEPS; i++) {
      const on = i < value;
      g.fillStyle(on ? (active ? THEME.accent : THEME.panelEdge) : THEME.panelInner, 1);
      g.fillRect(x0 + i * SEGMENT, y + (on ? 0 : 1), SEGMENT - 1, on ? 8 : 7);
    }
    this.root.add(g);
  }

  private drawArrows(cx: number, cy: number): void {
    const g = this.scene.add.graphics();
    g.fillStyle(THEME.accent, 1);
    const l = cx - ARROW_GAP;
    const r = cx + ARROW_GAP;
    g.fillTriangle(l + 2, cy - 3, l + 2, cy + 3, l - 2, cy);
    g.fillTriangle(r - 2, cy - 3, r - 2, cy + 3, r + 2, cy);
    this.root.add(g);
  }
}
