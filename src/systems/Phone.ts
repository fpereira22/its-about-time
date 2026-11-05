import { playSfx } from '../audio/sfx';
import phoneData from '../data/phone.json';
import type { PhoneData } from '../types/phone';
import { check } from './Conditions';
import { EventSystem } from './EventSystem';
import { clockMinutes, currentMission, formatClock } from './Mission';
import { StoryState, type PhoneEntry } from './StoryState';

export const PHONE = phoneData as unknown as PhoneData;

/**
 * Celular: mensajes y llamadas de la historia (src/data/phone.json).
 * - Los mensajes llegan al instante (notificación + bandeja en StoryState.phone).
 * - Las llamadas quedan en cola hasta que el jugador esté libre; la escena UI las muestra.
 */
class PhoneImpl {
  private readonly pendingCalls: string[] = [];

  /** Hora del celular ("17:45"): la actual, o la de llegada de un mensaje. */
  clock(entry?: PhoneEntry): string {
    if (!entry) return formatClock(clockMinutes());
    return formatClock(entry.min ?? clockMinutes(entry.at));
  }

  deliverMessage(id: string): void {
    const msg = PHONE.messages[id];
    if (!msg) {
      console.error(`phone.json: mensaje "${id}" no existe`);
      return;
    }
    StoryState.receiveMessage(id, clockMinutes());
    if (msg.mine) {
      // Lo mandaste tú: queda leído y suena el «fiu» de enviado, sin notificación.
      StoryState.markRead([id]);
      playSfx('enviado');
      return;
    }
    playSfx('notify');
    EventSystem.emit('phone-message', { id });
  }

  requestCall(id: string): void {
    if (!PHONE.calls[id]) {
      console.error(`phone.json: llamada "${id}" no existe`);
      return;
    }
    if (!this.pendingCalls.includes(id)) this.pendingCalls.push(id);
  }

  /** La UI toma la siguiente llamada cuando el jugador está libre. */
  takePendingCall(): string | undefined {
    return this.pendingCalls.shift();
  }

  /** Marca la llamada como terminada (contestada o rechazada): flag `llamada_<id>`. */
  endCall(id: string, answered: boolean): void {
    StoryState.setFlag(`llamada_${id}`);
    const missed = PHONE.calls[id]?.missed;
    if (!answered && missed) this.deliverMessage(missed);
  }

  /** Revisa las reglas automáticas (llamar cada frame mientras hay partida en curso). */
  update(): void {
    const mission = currentMission().id;
    for (const t of PHONE.triggers) {
      if (t.mission && t.mission !== mission) continue;
      const flag = `tel_${t.id}`;
      if (StoryState.hasFlag(flag)) continue;
      // Una llamada se reintenta (incluso tras recargar) hasta que se conteste o rechace.
      if (t.call && (StoryState.hasFlag(`llamada_${t.call}`) || this.pendingCalls.includes(t.call))) continue;
      if (t.afterMs !== undefined && StoryState.playTimeMs < t.afterMs) continue;
      if (!check(t.if)) continue;
      if (t.message) {
        StoryState.setFlag(flag);
        this.deliverMessage(t.message);
      }
      if (t.call) {
        StoryState.setFlag(flag);
        this.requestCall(t.call);
      }
    }
  }

  /** Llamar a un contacto (app Teléfono): devuelve el diálogo de la conversación, o null si no contesta. */
  dial(contact: string): string | null {
    return PHONE.outgoing.find((o) => o.to === contact && check(o.if))?.dialogue ?? null;
  }

  reset(): void {
    this.pendingCalls.length = 0;
  }
}

export const Phone = new PhoneImpl();
