import type Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { TouchControls } from './TouchControls';

const ADMIN_KEY = 'santiago-laberinto:admin';
/** Palabra que, tecleada en el título, activa o desactiva el modo admin (sin teclas del juego: WASD, E, F, M, Q, V). */
const ADMIN_CODE = 'colibri';
/** En el celular (sin teclado): toques seguidos sobre el logo del título que activan o desactivan el modo. */
const LOGO_TAPS = 7;
/** Pausa máxima entre toques del logo antes de empezar a contar de nuevo. */
const LOGO_TAP_GAP_MS = 1200;

/**
 * Modo admin: todas las misiones desbloqueadas, el atajo Ctrl + < (DevSkip), el selector de etapas (F2)
 * y F3, que fuerza los controles táctiles en cualquier equipo (Auto → Siempre → Nunca).
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

  get active(): boolean {
    return import.meta.env.DEV || this.stored;
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

export const Admin = new AdminImpl();
