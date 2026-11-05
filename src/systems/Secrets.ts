import { playSfx } from '../audio/sfx';
import { EventSystem } from './EventSystem';
import { currentMission } from './Mission';
import { StoryState } from './StoryState';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
const KONAMI_KEY = 'santiago-laberinto:konami';
export const FLAG_KONAMI = 'secreto_konami';

/**
 * Easter eggs: avisa cuando se activa la flag de un secreto de la misión y escucha el código Konami
 * (desbloquea la gorra dorada para siempre en este navegador).
 */
class SecretsImpl {
  private known = new Set<string>();
  private progress = 0;
  private attached = false;

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => this.onKey(e.code));
    EventSystem.on('state-changed', () => this.check());
  }

  /** ¿Se ingresó el código? (el jugador usa la gorra dorada). */
  konamiActive(): boolean {
    return this.konamiUnlocked();
  }

  /** Al empezar una partida: lo ya encontrado no se vuelve a anunciar; el código Konami se conserva. */
  syncNewGame(): void {
    if (this.konamiUnlocked()) StoryState.setFlag(FLAG_KONAMI);
    this.known = new Set(currentMission().secrets.filter((s) => StoryState.hasFlag(s.flag)).map((s) => s.flag));
  }

  private check(): void {
    const secrets = currentMission().secrets;
    for (const s of secrets) {
      if (!StoryState.hasFlag(s.flag) || this.known.has(s.flag)) continue;
      this.known.add(s.flag);
      const found = secrets.filter((x) => StoryState.hasFlag(x.flag)).length;
      playSfx('secret');
      EventSystem.emit('banner', { title: '¡Secreto encontrado!', subtitle: `${s.name} (${found}/${secrets.length})` });
    }
  }

  private onKey(code: string): void {
    this.progress = code === KONAMI[this.progress] ? this.progress + 1 : code === KONAMI[0] ? 1 : 0;
    if (this.progress < KONAMI.length) return;
    this.progress = 0;
    try {
      window.localStorage.setItem(KONAMI_KEY, '1');
    } catch {
      // Sin almacenamiento: dura esta sesión gracias a la flag.
    }
    StoryState.setFlag(FLAG_KONAMI);
  }

  private konamiUnlocked(): boolean {
    if (StoryState.hasFlag(FLAG_KONAMI)) return true;
    try {
      return window.localStorage.getItem(KONAMI_KEY) === '1';
    } catch {
      return false;
    }
  }
}

export const Secrets = new SecretsImpl();
