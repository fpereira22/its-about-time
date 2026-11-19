import Phaser from 'phaser';
import type { Direction } from '../types/map';
import { EventSystem } from './EventSystem';
import { DEFAULT_KEYS, REBINDABLE, Settings } from './Settings';

/** `trick`: filigrana en el partido de la misión 4 (F o Shift). */
export type Action = 'interact' | 'menu' | 'inventory' | 'mute' | 'phone' | 'toggleView' | 'trick' | Direction;

/** Teclas fijas: las flechas, Enter y Espacio, Esc, M y Shift. Las demás son las de Settings (se pueden cambiar). */
const FIXED_KEYS: Record<string, Action> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'interact',
  Space: 'interact',
  Escape: 'menu',
  KeyM: 'mute',
  ShiftLeft: 'trick',
  ShiftRight: 'trick',
};

/** Tecla → acción: las fijas más la tecla de cada acción según los ajustes. Se rehace al cambiar los ajustes. */
let keyMap: Record<string, Action> | null = null;
EventSystem.on('settings-changed', () => (keyMap = null));

function actionForKey(code: string): Action | undefined {
  if (!keyMap) {
    keyMap = { ...FIXED_KEYS };
    for (const a of REBINDABLE) keyMap[Settings.keyFor(a)] = a;
  }
  return keyMap[code];
}

/** Nombre corto de una tecla para mostrar ("KeyW" → "W", "ArrowUp" → "↑"). */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const names: Record<string, string> = { ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', Tab: 'Tab', CapsLock: 'Bloq Mayús' };
  return names[code] ?? code;
}

/** Tecla de fábrica de una acción (para textos de ayuda que no cambian). */
export { DEFAULT_KEYS };

const DIRECTION_ACTIONS = new Set<Action>(['up', 'down', 'left', 'right']);

/**
 * Entrada centralizada para todas las escenas: teclado y, en celulares, los controles táctiles
 * (src/systems/TouchControls.ts), que pulsan las mismas acciones.
 *
 * Las pulsaciones se "consumen": si el diálogo consume `interact`, el mundo ya no lo ve
 * en el mismo frame. Lo que nadie consumió se descarta al final del frame.
 */
class ControlsImpl {
  private readonly held = new Set<Action>();
  private readonly pressed = new Set<Action>();
  /** Direcciones mantenidas, la última pulsada al final. */
  private dirStack: Direction[] = [];
  private attached = false;

  attach(game: Phaser.Game): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.reset());
    game.events.on(Phaser.Core.Events.POST_STEP, () => this.pressed.clear());
  }

  /** Dirección mantenida más reciente, o null. */
  direction(): Direction | null {
    return this.dirStack.length > 0 ? this.dirStack[this.dirStack.length - 1] : null;
  }

  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  /** true una sola vez por pulsación. */
  consume(action: Action): boolean {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  reset(): void {
    this.held.clear();
    this.pressed.clear();
    this.dirStack = [];
  }

  /** Pulsa una acción desde otra fuente (los controles táctiles). Igual que una tecla. */
  press(action: Action): void {
    if (this.held.has(action)) return;
    this.held.add(action);
    this.pressed.add(action);
    if (DIRECTION_ACTIONS.has(action)) {
      const dir = action as Direction;
      this.dirStack = this.dirStack.filter((d) => d !== dir);
      this.dirStack.push(dir);
    }
  }

  /** Suelta una acción pulsada con `press`. */
  release(action: Action): void {
    this.held.delete(action);
    if (DIRECTION_ACTIONS.has(action)) {
      this.dirStack = this.dirStack.filter((d) => d !== action);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    const action = actionForKey(e.code);
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    this.held.delete(action);
    this.press(action);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const action = actionForKey(e.code);
    if (!action) return;
    this.release(action);
  }
}

export const Controls = new ControlsImpl();
