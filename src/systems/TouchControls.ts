import type Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, setTouchBox } from '../config/display';
import type { Direction } from '../types/map';
import { Controls, type Action } from './Controls';

/** auto: solo en celulares y tablets · on: siempre (para probar en el PC) · off: nunca. */
export type TouchMode = 'auto' | 'on' | 'off';

const MODE_KEY = 'santiago-laberinto:touch';
const MODES: TouchMode[] = ['auto', 'on', 'off'];
const MODE_NAME: Record<TouchMode, string> = { auto: 'AUTO', on: 'SIEMPRE', off: 'NUNCA' };

/** Proporción eje menor / eje mayor desde la que la cruceta pulsa una diagonal (dos direcciones). */
const DIAGONAL = 0.65;
/** Zona muerta al centro de la cruceta, como fracción del radio. */
const DEADZONE = 0.2;
/** Separación (px) entre los controles y el borde de la pantalla. */
const EDGE = 12;

/**
 * Botones rotulados con la tecla que reemplazan: así las ayudas del juego ("E: hablar",
 * "Esc: cerrar", "W/S: elegir"...) valen igual en el celular, sin reescribirlas.
 */
interface ButtonDef {
  action: Action;
  key: string;
  label: string;
}
const SYS_LEFT: ButtonDef[] = [
  { action: 'menu', key: 'ESC', label: 'menú' },
  { action: 'inventory', key: 'TAB', label: 'bolso' },
];
const SYS_RIGHT: ButtonDef[] = [
  { action: 'phone', key: 'Q', label: 'celu' },
  { action: 'toggleView', key: 'V', label: 'vista' },
  { action: 'mute', key: 'M', label: 'sonido' },
];

/** Cruceta de 4 brazos con las letras WASD (las ayudas del juego hablan de W/S, A/D y WASD). */
const DPAD_SVG = `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <circle class="tc-ring" cx="50" cy="50" r="48"/>
  <rect class="tc-arm" data-dir="up" x="35" y="7" width="30" height="31" rx="5"/>
  <rect class="tc-arm" data-dir="down" x="35" y="62" width="30" height="31" rx="5"/>
  <rect class="tc-arm" data-dir="left" x="7" y="35" width="31" height="30" rx="5"/>
  <rect class="tc-arm" data-dir="right" x="62" y="35" width="31" height="30" rx="5"/>
  <rect class="tc-hub" x="34" y="34" width="32" height="32"/>
  <circle class="tc-dot" cx="50" cy="50" r="5"/>
  <path class="tc-arrow" d="M50 12 L44 20 H56 Z M50 88 L44 80 H56 Z M12 50 L20 44 V56 Z M88 50 L80 44 V56 Z"/>
  <text class="tc-letter" x="50" y="33">W</text>
  <text class="tc-letter" x="50" y="75">S</text>
  <text class="tc-letter" x="29" y="54">A</text>
  <text class="tc-letter" x="71" y="54">D</text>
</svg>`;

const FULLSCREEN_SVG = `
<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">
  <path fill="currentColor" d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z"/>
</svg>`;

const CSS = `
html.tc-on, html.tc-on body { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#game.tc-fit canvas { width: var(--tc-gw) !important; height: var(--tc-gh) !important; margin: 0 !important; }
#game.tc-fit.tc-portrait { align-items: flex-start; padding-top: var(--tc-top, 8px); box-sizing: border-box; }
#touch { position: fixed; inset: 0; z-index: 10; pointer-events: none; font-family: "Silkscreen", monospace;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
  --pad: 150px; --gutter: 140px; --edge: ${EDGE}px; }
#touch[hidden] { display: none; }
#touch .tc { position: absolute; pointer-events: auto; touch-action: none; }
#touch .tc-dpad { width: var(--pad); height: var(--pad);
  left: calc(env(safe-area-inset-left, 0px) + var(--edge)); bottom: calc(env(safe-area-inset-bottom, 0px) + var(--edge)); }
#touch .tc-dpad svg { display: block; width: 100%; height: 100%; overflow: visible; }
#touch .tc-ring { fill: rgba(10, 14, 24, 0.38); stroke: rgba(255, 255, 255, 0.16); stroke-width: 1.5; }
#touch .tc-arm, #touch .tc-hub { fill: rgba(28, 42, 72, 0.82); }
#touch .tc-arm { stroke: rgba(200, 216, 255, 0.35); stroke-width: 1.2; transition: fill 60ms; }
#touch .tc-arm.on { fill: rgba(47, 111, 208, 0.95); }
#touch .tc-dot { fill: rgba(10, 14, 24, 0.55); }
#touch .tc-arrow { fill: rgba(240, 244, 255, 0.92); }
#touch .tc-letter { fill: rgba(200, 212, 240, 0.7); font-size: 8px; text-anchor: middle; font-family: "Silkscreen", monospace; }
#touch .tc-ab { width: var(--pad); height: var(--pad); pointer-events: none;
  right: calc(env(safe-area-inset-right, 0px) + var(--edge)); bottom: calc(env(safe-area-inset-bottom, 0px) + var(--edge)); }
#touch .tc-round { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; justify-content: center; color: #f4f6ff;
  border: 2px solid rgba(255, 255, 255, 0.35); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.35); transition: transform 60ms, filter 60ms; }
#touch .tc-round b { font-weight: 400; line-height: 1; }
#touch .tc-round small { font-family: "Pixelify Sans", monospace; font-size: 10px; line-height: 1; margin-top: 3px; opacity: 0.85; }
#touch .tc-e { width: 52%; height: 52%; right: 0; top: 6%; background: rgba(47, 111, 208, 0.78); }
#touch .tc-e b { font-size: calc(var(--pad) * 0.17); }
#touch .tc-f { width: 38%; height: 38%; left: 4%; bottom: 4%; background: rgba(196, 84, 64, 0.72); }
#touch .tc-f b { font-size: calc(var(--pad) * 0.12); }
#touch .tc-sys { display: flex; flex-wrap: wrap; gap: 6px; max-width: calc(var(--gutter) - var(--edge) - 4px); pointer-events: none; }
#touch .tc-sys-l { left: calc(env(safe-area-inset-left, 0px) + var(--edge)); top: calc(env(safe-area-inset-top, 0px) + var(--edge)); }
#touch .tc-sys-r { right: calc(env(safe-area-inset-right, 0px) + var(--edge)); top: calc(env(safe-area-inset-top, 0px) + var(--edge)); justify-content: flex-end; }
#touch.tc-portrait .tc-sys { top: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + var(--edge) + var(--pad) + 18px); max-width: 48vw; }
#touch .tc-pill { pointer-events: auto; touch-action: none; min-width: 40px; height: 34px; padding: 0 6px; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 9px;
  background: rgba(16, 22, 40, 0.66); border: 1.5px solid rgba(255, 255, 255, 0.26); color: #e8ecf8;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35); transition: transform 60ms, filter 60ms; }
#touch .tc-pill b { font-weight: 400; font-size: 11px; line-height: 1; }
#touch .tc-pill small { font-family: "Pixelify Sans", monospace; font-size: 9px; line-height: 1; margin-top: 2px; opacity: 0.75; }
#touch .tc-pill svg { width: 14px; height: 14px; }
#touch .on.tc-round, #touch .on.tc-pill { transform: scale(0.92) translateY(2px); filter: brightness(1.45); box-shadow: none; }
#touch-toast { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 10px); transform: translateX(-50%); z-index: 11;
  padding: 6px 12px; border-radius: 8px; background: rgba(16, 22, 40, 0.9); color: #ffd28a; border: 1px solid rgba(255, 210, 138, 0.5);
  font: 11px "Silkscreen", monospace; pointer-events: none; opacity: 0; transition: opacity 180ms; }
#touch-toast.show { opacity: 1; }
`;

/**
 * Controles táctiles: cruceta, botones E y F, y una fila con ESC, TAB, Q, V, M (y pantalla completa).
 * Viven en HTML encima del canvas y pulsan las mismas acciones que el teclado (Controls.press), así que
 * ninguna escena necesita saber de ellos.
 *
 * Se muestran solos en celulares y tablets (sin mouse). El modo admin puede forzarlos en cualquier
 * equipo (F3 o la página "Herramientas" del selector de etapas) para probarlos en el PC; la elección
 * queda guardada en este navegador.
 *
 * Con los controles a la vista el juego se ajusta al espacio libre: en horizontal entre la cruceta y
 * los botones, en vertical arriba (estilo consola de bolsillo) con los controles abajo.
 */
class TouchControlsImpl {
  private mode: TouchMode = readMode();
  private root: HTMLDivElement | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimer = 0;
  private game: Phaser.Game | null = null;
  private relayout: () => void = () => {};
  private portrait = false;
  /** En vertical: franja (px CSS) sobre los controles donde se centra el juego. */
  private band = { top: 0, height: 0 };
  /** Acciones que los controles tienen pulsadas ahora (para soltarlas todas si se ocultan). */
  private readonly down = new Set<Action>();
  private dpadDirs: Direction[] = [];
  private dpadPointer: number | null = null;
  private readonly arms = new Map<Direction, Element>();
  private readonly touchQuery = window.matchMedia?.('(hover: none) and (pointer: coarse)') ?? null;

  /** ¿Se están mostrando los controles? */
  get enabled(): boolean {
    return this.mode === 'on' || (this.mode === 'auto' && isTouchDevice(this.touchQuery));
  }

  /** Texto del modo para menús: "AUTO (sí)", "SIEMPRE", "NUNCA". */
  modeLabel(): string {
    if (this.mode !== 'auto') return MODE_NAME[this.mode];
    return `AUTO (${isTouchDevice(this.touchQuery) ? 'sí' : 'no'})`;
  }

  /** Crea los controles y decide dónde va el juego. Antes de crear el Phaser.Game (define el zoom inicial). */
  mount(): void {
    if (this.root) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'touch';
    root.hidden = true;
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    root.appendChild(this.buildDpad());

    const ab = el('div', 'tc tc-ab');
    ab.appendChild(this.buildButton('tc-round tc-e', { action: 'interact', key: 'E', label: 'acción' }));
    ab.appendChild(this.buildButton('tc-round tc-f', { action: 'trick', key: 'F', label: '' }));
    root.appendChild(ab);

    const left = el('div', 'tc tc-sys tc-sys-l');
    for (const def of SYS_LEFT) left.appendChild(this.buildButton('tc-pill', def));
    if (canFullscreen()) left.appendChild(this.buildFullscreen());
    root.appendChild(left);
    const right = el('div', 'tc tc-sys tc-sys-r');
    for (const def of SYS_RIGHT) right.appendChild(this.buildButton('tc-pill', def));
    root.appendChild(right);

    document.body.appendChild(root);
    this.root = root;

    this.toast = el('div', '') as HTMLDivElement;
    this.toast.id = 'touch-toast';
    document.body.appendChild(this.toast);

    this.layout();
  }

  /** Conecta con el juego. `relayout` vuelve a calcular el canvas (al cambiar el modo o el equipo). */
  attach(game: Phaser.Game, relayout: () => void): void {
    this.game = game;
    this.relayout = relayout;
    this.touchQuery?.addEventListener?.('change', () => this.relayout());
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => document.hidden && this.releaseAll());
  }

  /** Auto → Siempre → Nunca → Auto. Devuelve el modo nuevo. */
  cycleMode(): TouchMode {
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    try {
      if (this.mode === 'auto') window.localStorage.removeItem(MODE_KEY);
      else window.localStorage.setItem(MODE_KEY, this.mode);
    } catch {
      // Sin almacenamiento: dura esta sesión.
    }
    this.relayout();
    this.showToast(`Controles táctiles: ${this.modeLabel()}`);
    return this.mode;
  }

  /**
   * Muestra u oculta los controles, los ubica según la orientación y le dice a display.ts en qué
   * caja debe caber el juego. Llamar antes de computeDisplay().
   */
  layout(): void {
    const root = this.root;
    if (!root) return;
    const on = this.enabled;
    root.hidden = !on;
    document.documentElement.classList.toggle('tc-on', on);
    if (!on) {
      this.releaseAll();
      setTouchBox(null);
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const safe = safeInsets();
    this.portrait = h > w;
    root.classList.toggle('tc-portrait', this.portrait);

    if (this.portrait) {
      const pad = clamp(w * 0.4, 120, 200);
      root.style.setProperty('--pad', `${pad}px`);
      root.style.setProperty('--gutter', `${w / 2}px`);
      // Arriba el juego; abajo la cruceta, los botones y la fila de ESC/TAB/Q... (con aire entre medio).
      const controls = EDGE + pad + 18 + 34 + 24 + safe.bottom;
      this.band = { top: safe.top + 8, height: Math.max(90, h - controls - safe.top - 8) };
      setTouchBox({ w: w - 12 - safe.left - safe.right, h: this.band.height });
    } else {
      const pad = clamp(h * 0.36, 100, 180);
      // El juego queda entre los controles; si la pantalla es angosta, se monta un poco sobre ellos.
      const gutter = Math.min(w * 0.22, pad + EDGE + Math.max(safe.left, safe.right));
      root.style.setProperty('--pad', `${pad}px`);
      root.style.setProperty('--gutter', `${gutter}px`);
      setTouchBox({ w: w - 2 * gutter, h: h - safe.top - safe.bottom });
    }
  }

  /** Tamaño en pantalla del canvas (null: el de siempre, a zoom entero). */
  sizeCanvas(cssScale: number | null): void {
    const host = document.getElementById('game');
    if (!host) return;
    const fit = cssScale !== null;
    host.classList.toggle('tc-fit', fit);
    host.classList.toggle('tc-portrait', fit && this.portrait);
    if (fit) {
      const gh = Math.round(BASE_HEIGHT * cssScale);
      host.style.setProperty('--tc-gw', `${Math.round(BASE_WIDTH * cssScale)}px`);
      host.style.setProperty('--tc-gh', `${gh}px`);
      // En vertical, centrado (un poco hacia arriba) en el espacio sobre los controles.
      const top = this.band.top + Math.max(0, (this.band.height - gh) * 0.4);
      host.style.setProperty('--tc-top', `${Math.round(top)}px`);
    }
    // Phaser recalcula el centrado y las medidas en pantalla (el toque sobre el canvas las usa:
    // maletas, mapa de la línea); si no, al salir del modo táctil el canvas queda corrido.
    window.requestAnimationFrame(() => this.game?.scale.refresh());
  }

  // ---------------------------------------------------------------------------

  private buildDpad(): HTMLElement {
    const pad = el('div', 'tc tc-dpad');
    pad.innerHTML = DPAD_SVG;
    for (const arm of pad.querySelectorAll('.tc-arm')) this.arms.set(arm.getAttribute('data-dir') as Direction, arm);

    const track = (e: PointerEvent): void => {
      if (e.pointerId !== this.dpadPointer) return;
      e.preventDefault();
      const r = pad.getBoundingClientRect();
      const radius = r.width / 2;
      this.setDpad(dpadDirections(e.clientX - (r.left + radius), e.clientY - (r.top + radius), radius));
    };
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.dpadPointer) return;
      this.dpadPointer = null;
      this.setDpad([]);
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dpadPointer = e.pointerId;
      pad.setPointerCapture?.(e.pointerId);
      track(e);
    });
    pad.addEventListener('pointermove', track);
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
    return pad;
  }

  /** Pulsa y suelta lo justo para que la cruceta quede en `dirs` (el eje principal, al final). */
  private setDpad(dirs: Direction[]): void {
    const before = this.dpadDirs;
    if (before.length === dirs.length && before.every((d, i) => d === dirs[i])) return;
    for (const d of before) if (!dirs.includes(d)) this.release(d);
    const fresh = dirs.filter((d) => !before.includes(d));
    for (const d of fresh) this.press(d);
    if (fresh.length > 0) buzz();
    this.dpadDirs = dirs;
    for (const [dir, arm] of this.arms) arm.classList.toggle('on', dirs.includes(dir));
  }

  private buildButton(cls: string, def: ButtonDef): HTMLElement {
    const b = el('div', cls);
    b.innerHTML = `<b>${def.key}</b>${def.label ? `<small>${def.label}</small>` : ''}`;
    this.holdable(b, () => this.press(def.action), () => this.release(def.action));
    return b;
  }

  private buildFullscreen(): HTMLElement {
    const b = el('div', 'tc-pill');
    b.innerHTML = `${FULLSCREEN_SVG}<small>pantalla</small>`;
    this.holdable(b, toggleFullscreen, () => {});
    return b;
  }

  /** Mientras un dedo esté encima, el botón está pulsado (aunque se deslice afuera). */
  private holdable(b: HTMLElement, onDown: () => void, onUp: () => void): void {
    let pointer: number | null = null;
    const up = (e: PointerEvent): void => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      b.classList.remove('on');
      onUp();
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointer !== null) return;
      pointer = e.pointerId;
      b.setPointerCapture?.(e.pointerId);
      b.classList.add('on');
      buzz();
      onDown();
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  }

  private press(action: Action): void {
    this.down.add(action);
    Controls.press(action);
  }

  private release(action: Action): void {
    if (!this.down.delete(action)) return;
    Controls.release(action);
  }

  private releaseAll(): void {
    this.setDpad([]);
    this.dpadPointer = null;
    for (const a of [...this.down]) this.release(a);
    this.root?.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
  }

  private showToast(text: string): void {
    const t = this.toast;
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 1600);
  }
}

/** Direcciones de la cruceta para un dedo en (dx, dy) respecto del centro. */
function dpadDirections(dx: number, dy: number, radius: number): Direction[] {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < radius * DEADZONE) return [];
  const h: Direction = dx < 0 ? 'left' : 'right';
  const v: Direction = dy < 0 ? 'up' : 'down';
  const [major, minor] = ax >= ay ? [h, v] : [v, h];
  const diagonal = Math.min(ax, ay) >= Math.max(ax, ay) * DIAGONAL;
  return diagonal ? [minor, major] : [major];
}

/** Celular o tablet: pantalla táctil sin mouse (los notebooks táctiles siguen con teclado). */
function isTouchDevice(query: MediaQueryList | null): boolean {
  if (query?.matches) return true;
  return navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function readMode(): TouchMode {
  try {
    const v = window.localStorage.getItem(MODE_KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Márgenes seguros (notch, barra de gestos) en px, leídos de env(safe-area-inset-*). */
function safeInsets(): { top: number; right: number; bottom: number; left: number } {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  const cs = window.getComputedStyle(probe);
  const out = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  probe.remove();
  return out;
}

function canFullscreen(): boolean {
  return Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => {});
    return;
  }
  document.documentElement
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      // En Android se puede fijar la horizontal (iOS no lo permite: ahí el juego se adapta solo).
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      return orientation.lock?.('landscape');
    })
    .catch(() => {});
}

/** Vibración cortita al pulsar (solo donde existe, p. ej. Android). */
function buzz(): void {
  try {
    navigator.vibrate?.(8);
  } catch {
    // Algunos navegadores la bloquean sin interacción previa.
  }
}

function el(tag: string, cls: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const TouchControls = new TouchControlsImpl();
