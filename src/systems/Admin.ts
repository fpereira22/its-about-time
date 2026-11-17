import type Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { TouchControls } from './TouchControls';

const ADMIN_KEY = 'santiago-laberinto:admin';
const DEBUG_KEY = 'santiago-laberinto:admin-debug';

/** Depuración (F4): 0 apagada · 1 panel con coordenadas · 2 panel + cuadrícula sobre el mapa. */
export type DebugMode = 0 | 1 | 2;
/** Palabra que, tecleada en el título, activa o desactiva el modo admin (sin teclas del juego: WASD, E, F, M, Q, V). */
const ADMIN_CODE = 'colibri';
/** En el celular (sin teclado): toques seguidos sobre el logo del título que activan o desactivan el modo. */
const LOGO_TAPS = 7;
/** Pausa máxima entre toques del logo antes de empezar a contar de nuevo. */
const LOGO_TAP_GAP_MS = 1200;

/**
 * Modo admin: todas las misiones desbloqueadas, el atajo Ctrl + < (DevSkip), el selector de etapas (F2,
 * con animaciones, viñetas y sonidos para probar), F3, que fuerza los controles táctiles en cualquier equipo
 * (Auto → Siempre → Nunca), y F4, la depuración (coordenadas del jugador y del cursor, y cuadrícula del mapa).
 * Con `npm run dev` está siempre activo. En el juego publicado se activa (y desactiva) tecleando
 * ADMIN_CODE en el título, o en el celular tocando el logo LOGO_TAPS veces seguidas; queda guardado
 * en este navegador.
 *
 * No es seguridad real: sin servidor, cualquiera puede editar localStorage. Solo evita que un
 * jugador normal se salte misiones sin querer.
 */
class AdminImpl {
  private typed = '';
  private logoTaps = 0;
  private lastLogoTap = 0;
  private attached = false;
  private stored = readStored();
  private debug: DebugMode = readDebug();

  get active(): boolean {
    return import.meta.env.DEV || this.stored;
  }

  /** Nivel de depuración (siempre 0 si no hay modo admin). */
  get debugMode(): DebugMode {
    return this.active ? this.debug : 0;
  }

  /** Apagada → panel → panel + cuadrícula → apagada. Se recuerda en este navegador. */
  cycleDebug(): DebugMode {
    this.debug = ((this.debug + 1) % 3) as DebugMode;
    try {
      if (this.debug) window.localStorage.setItem(DEBUG_KEY, String(this.debug));
      else window.localStorage.removeItem(DEBUG_KEY);
    } catch {
      // Sin almacenamiento: dura esta sesión.
    }
    return this.debug;
  }

  attach(game: Phaser.Game): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2' && this.active) {
        e.preventDefault();
        if (!e.repeat) this.toggleWarp(game);
        return;
      }
      if (e.code === 'F3' && this.active) {
        e.preventDefault();
        if (!e.repeat) {
          TouchControls.cycleMode();
          playSfx('select');
        }
        return;
      }
      if (e.code === 'F4' && this.active) {
        e.preventDefault();
        if (!e.repeat) {
          playSfx(this.cycleDebug() ? 'select' : 'cancel');
        }
        return;
      }
      if (e.key.length !== 1) return;
      this.typed = (this.typed + e.key.toLowerCase()).slice(-ADMIN_CODE.length);
      if (this.typed !== ADMIN_CODE || !game.scene.isActive('Title')) return;
      this.typed = '';
      this.toggle(game);
    });
  }

  /** Abre el selector de etapas (AdminWarpScene), o lo cierra si ya está abierto. */
  toggleWarp(game: Phaser.Game): void {
    if (game.scene.isActive('AdminWarp')) {
      (game.scene.getScene('AdminWarp') as unknown as { close(): void }).close();
      return;
    }
    // Todavía cargando: las texturas se generan en Boot/Preload.
    if (game.scene.getScenes(true).every((s) => s.scene.key === 'Boot' || s.scene.key === 'Preload')) return;
    game.scene.start('AdminWarp');
    game.scene.bringToTop('AdminWarp');
  }

  /** Un toque al logo del título: al séptimo seguido, activa o desactiva el modo admin. */
  tapLogo(game: Phaser.Game): void {
    const now = performance.now();
    this.logoTaps = now - this.lastLogoTap > LOGO_TAP_GAP_MS ? 1 : this.logoTaps + 1;
    this.lastLogoTap = now;
    if (this.logoTaps < LOGO_TAPS) return;
    this.logoTaps = 0;
    this.toggle(game);
  }

  private toggle(game: Phaser.Game): void {
    this.stored = !this.stored;
    try {
      if (this.stored) window.localStorage.setItem(ADMIN_KEY, '1');
      else window.localStorage.removeItem(ADMIN_KEY);
    } catch {
      // Sin almacenamiento: dura esta sesión.
    }
    playSfx(this.stored ? 'select' : 'cancel');
    // El título se rehace para mostrar (o quitar) los candados y la etiqueta ADMIN.
    game.scene.getScene('Title').scene.restart();
  }
}

function readStored(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_KEY) === '1';
  } catch {
    return false;
  }
}

function readDebug(): DebugMode {
  try {
    const v = Number(window.localStorage.getItem(DEBUG_KEY));
    return v === 1 || v === 2 ? v : 0;
  } catch {
    return 0;
  }
}

export const Admin = new AdminImpl();
