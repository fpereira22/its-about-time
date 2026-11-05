import { playSfx } from '../audio/sfx';
import type { Effect } from '../types/story';
import { EventSystem } from './EventSystem';
import { parseClock } from './Mission';
import { Phone } from './Phone';
import { currentOutfit } from './PlayerLook';
import { formatMoney, ITEMS, StoryState } from './StoryState';

export interface EffectOutcome {
  /** Mensajes automáticos para mostrar en el diálogo ("¡Obtuviste ...!"). */
  announcements: string[];
  /** Efectos que cambian de escena: se ejecutan cuando se cierra el diálogo. */
  deferred: Effect[];
}

/** Aplica efectos inmediatos y separa los que deben esperar a que termine el diálogo. */
export function applyEffects(effects: Effect[] | undefined): EffectOutcome {
  const out: EffectOutcome = { announcements: [], deferred: [] };
  for (const e of effects ?? []) {
    if ('setFlag' in e) {
      for (const f of [e.setFlag].flat()) StoryState.setFlag(f, true);
    } else if ('clearFlag' in e) {
      for (const f of [e.clearFlag].flat()) StoryState.setFlag(f, false);
    } else if ('giveItem' in e) {
      StoryState.addItem(e.giveItem, e.qty ?? 1);
      playSfx('item');
      if (!e.silent) out.announcements.push(`¡Obtuviste ${ITEMS[e.giveItem]?.name ?? e.giveItem}!`);
    } else if ('takeItem' in e) {
      StoryState.removeItem(e.takeItem, e.qty ?? 1);
    } else if ('giveMoney' in e) {
      StoryState.addMoney(e.giveMoney);
      playSfx('coin');
      out.announcements.push(`Recibiste ${formatMoney(e.giveMoney)}.`);
    } else if ('pay' in e) {
      playSfx('coin');
      if (!StoryState.spend(e.pay)) console.warn(`Efecto pay ${e.pay} sin plata suficiente (usa minMoney en la condición)`);
    } else if ('chargeBip' in e) {
      playSfx('bip');
      StoryState.chargeBip(e.chargeBip);
    } else if ('payBip' in e) {
      playSfx('bip');
      if (!StoryState.payBip(e.payBip)) console.warn(`Efecto payBip ${e.payBip} sin saldo (usa minBip en la condición)`);
    } else if ('message' in e) {
      Phone.deliverMessage(e.message);
    } else if ('call' in e) {
      Phone.requestCall(e.call);
    } else if ('sfx' in e) {
      playSfx(e.sfx);
    } else if ('addTime' in e) {
      StoryState.addTime(e.addTime);
    } else if ('objective' in e) {
      StoryState.setObjective(e.objective);
    } else if ('clock' in e) {
      const at = parseClock(e.clock);
      StoryState.setClock(at, e.max !== undefined ? parseClock(e.max, at) : undefined);
    } else if ('clockAdd' in e) {
      const at = StoryState.clock + e.clockAdd;
      StoryState.setClock(at, Math.max(at, StoryState.clockMax));
    } else if ('clockMax' in e) {
      StoryState.setClock(StoryState.clock, parseClock(e.clockMax));
    } else if ('doc' in e) {
      EventSystem.emit('document', { doc: e.doc, id: e.id });
    } else if ('board' in e) {
      EventSystem.emit('board', e.board);
    } else if ('vineta' in e) {
      EventSystem.emit('vineta', e.vineta);
    } else if ('sign' in e) {
      EventSystem.emit('sign', { id: e.sign, step: e.step });
    } else if ('signMark' in e) {
      EventSystem.emit('sign-mark', e.signMark);
    } else if ('weather' in e) {
      StoryState.setWeather(e.weather);
    } else if ('outfit' in e) {
      StoryState.setOutfit({ ...currentOutfit(), ...e.outfit });
    } else {
      out.deferred.push(e);
    }
  }
  return out;
}

/** Ejecuta warp, startScene y event (después de cerrar el diálogo). */
export function runDeferred(effects: Effect[]): void {
  for (const e of effects) {
    if ('warp' in e) EventSystem.emit('warp', e.warp);
    else if ('startScene' in e) EventSystem.emit('start-scene', { scene: e.startScene, data: e.data });
    else if ('event' in e) EventSystem.emit('story', { name: e.event, data: e.data });
  }
}
