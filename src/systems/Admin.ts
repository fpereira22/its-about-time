import type Phaser from 'phaser';
import { playSfx } from '../audio/sfx';

const ADMIN_KEY = 'santiago-laberinto:admin';
/** Palabra que, tecleada en el título, activa o desactiva el modo admin (sin teclas del juego: WASD, E, F, M, Q, V). */
const ADMIN_CODE = 'colibri';

/**
 * Modo admin: todas las misiones desbloqueadas, el atajo Ctrl + < (DevSkip) y el selector de etapas (F2).
 * Con `npm run dev` está siempre activo. En el juego publicado se activa (y desactiva) tecleando
 * ADMIN_CODE en el título; queda guardado en este navegador.
 *
 * No es seguridad real: sin servidor, cualquiera puede editar localStorage. Solo evita que un
 * jugador normal se salte misiones sin querer.
 */
class AdminImpl {
  private typed = '';
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
