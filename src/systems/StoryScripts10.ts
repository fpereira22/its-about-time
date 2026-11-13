import { playMusic, playSfx, type MusicTrack } from '../audio/sfx';
import type { RioMode, RioResult } from '../scenes/RioScene';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { advanceClock, parseClock } from './Mission';
import { FLAG_SWIM } from './PlayerLook';
import { StoryState } from './StoryState';
import type { ScriptHost } from './StoryScripts';

/**
 * Scripts de la misión 10 («Río abajo»): el domingo después de la fiesta en Cristo Rey. Sin haber dormido, Danilo
 * te invita (solo a ti) al río Pance: te alistas en el 805, suena el citófono, lo buscas en el sótano del Bobo y en
 * su carro hablan de anoche camino a Pance. Allá: parquear en el Ecoparque, la playa del Puente 3, la «ducha» en el
 * chorro, río abajo en neumático hasta el Puente 4 (el colgante), fotos en el puente, los recuerdos en un piedrón,
 * el sancocho de doña Nelly donde casi no hay gente, la historia de Fotogram, la respuesta de Laura («tío, qué
 * máquina...») y el corazoncito. Y de vuelta al Bobo, a dormir por fin. Se suman a SCRIPTS en StoryScripts.ts.
 */

type Script = (host: ScriptHost, data: Record<string, unknown>) => Promise<void> | void;

function clockTo(host: ScriptHost, at: string, ms: number): Promise<void> {
  return advanceClock(parseClock(at), ms, (w) => host.wait(w));
}

function clockAt(at: string, max?: string): void {
  const t = Math.max(StoryState.clock, parseClock(at));
  StoryState.setClock(t, max ? Math.max(t, parseClock(max)) : t);
}

function has(flag: string): boolean {
  return StoryState.hasFlag(flag);
}

function set(...flags: string[]): void {
  for (const f of flags) StoryState.setFlag(f);
}

function clear(...flags: string[]): void {
  for (const f of flags) StoryState.setFlag(f, false);
}

/** Danilo camina contigo (vestido o en pantaloneta). */
function danilo(mode: 'ropa' | 'bano' | null): void {
  StoryState.setFlag('m10_sigue_danilo', mode === 'ropa');
  StoryState.setFlag('m10_sigue_danilo_bano', mode === 'bano');
}

function banner(title: string, subtitle?: string): void {
  EventSystem.emit('banner', { title, subtitle });
}

function rio(mode: RioMode, photos?: string[]): Promise<RioResult> {
  return new Promise<RioResult>((done) => EventSystem.emit('open-rio', { mode, photos, done }));
}

/** Las fotos buenas del puente (para la historia de Fotogram). */
let galeria: string[] = [];

/** El carro de ida, tramo por tramo (del sótano del Bobo al km 12 de la Vía a Pance). */
const IDA: Array<{ title: string; subtitle: string; at: string; dialogue: string }> = [
  { title: 'Sótano del Bobo → Calle 18', subtitle: 'En el carro de Danilo', at: 'dom 10:32', dialogue: 'm10_carro_1' },
  { title: 'Avenida Cañasgordas', subtitle: 'Hacia el sur, hacia Pance', at: 'dom 10:40', dialogue: 'm10_carro_2' },
  { title: 'Vía a Pance (Carrera 122)', subtitle: 'Guaduales, fincas y ciclistas', at: 'dom 10:52', dialogue: 'm10_carro_3' },
  { title: 'Ecoparque Río Pance', subtitle: 'Km 12 · domingo', at: 'dom 11:02', dialogue: 'm10_carro_4' },
];

const VUELTA: Array<{ title: string; subtitle: string; at: string }> = [
  { title: 'Vía a Pance', subtitle: 'De vuelta, con el sol bajando', at: 'dom 17:05' },
  { title: 'Avenida Cañasgordas', subtitle: 'Hacia el Bobo', at: 'dom 17:20' },
];

export const M10_SCRIPTS: Record<string, Script> = {
  /** Cada vez que agarras algo para el río: con la pantaloneta, la toalla y el bloqueador, suena el citófono. */
  async alistado_m10(host) {
    if (has('m10_timbre') || !has('m10_pantaloneta') || !has('m10_toalla') || !has('m10_bloqueador')) return;
    while (Dialogue.active) await host.wait(200);
    host.setLocked(true);
    await host.wait(400);
    await host.say('m10_listo');
    await clockTo(host, 'dom 10:05', 1200);
    playSfx('bell');
    await host.wait(500);
    await host.say('m10_timbre');
    StoryState.setClock(StoryState.clock, parseClock('dom 10:30'));
    host.setLocked(false);
  },

  /** El ascensor del Bobo en la misión 10: del 8 al sótano (botón S) y de vuelta. */
  async ascensor_m10(host, data) {
    const to = String(data.to ?? 'sotano');
    host.setLocked(true);
    banner(to === 'sotano' ? 'Bajando al sótano...' : 'Subiendo al 8...', 'Ascensor del Bobo Unic Living');
    playMusic('ascensor');
    await host.wait(1100);
    playSfx('elevator');
    if (to === 'sotano') host.goTo('bobo_sotano', 'ascensor');
    else host.goTo('bobo_piso8', 'ascensor');
  },

  /** Subirse al carro de Danilo, en el puesto de visitantes. */
  async carro_m10(host) {
    if (has('m10_en_carro')) return;
    host.setLocked(true);
    set('m10_en_carro');
    playSfx('door');
    await host.fade(true, 600);
    host.goTo('carro_danilo', 'asiento');
  },

  /** La radio del carro (la elige el copiloto). */
  radio_m10(_host, data) {
    const track = String(data.track ?? '');
    playMusic(track ? (track as MusicTrack) : null);
  },

  /** El carro: la ida a Pance (cuatro tramos y el parqueadero) o la vuelta al Bobo. */
  async viaje_carro_m10(host) {
    if (has('m10_vuelta')) {
      await vuelta(host);
      return;
    }
    if (has('m10_ida')) return;
    set('m10_ida');
    host.setLocked(true);
    playMusic('carro_danilo');
    await host.wait(500);
    for (const leg of IDA) {
      banner(leg.title, leg.subtitle);
      host.shake(300, 0.0015);
      await clockTo(host, leg.at, 2400);
      await host.say(leg.dialogue);
    }
    const r = await rio('parquear');
    if (r.good || r.skipped) set('m10_parqueo_bien');
    playMusic('carro_danilo');
    await host.wait(300);
    await host.say('m10_parquear_post');
    await host.fade(true, 700);
    danilo('ropa');
    clockAt('dom 11:10', 'dom 11:40');
    host.goTo('pance_rio', 'llegada');
  },

  /** La playa del Puente 3: la de todo el mundo. Ahí se quedan en pantaloneta. */
  async playa_m10(host) {
    if (has('m10_playa')) return;
    host.setLocked(true);
    host.facePlayer('down');
    clockAt('dom 11:25', 'dom 11:50');
    await host.say('m10_playa');
    host.setLocked(false);
  },

  /** Danilo se saca la camisa (y tú también). */
  bano_m10() {
    StoryState.setFlag(FLAG_SWIM);
    danilo('bano');
  },

  /** El chorro: la ducha helada. */
  async chorro_m10(host) {
    if (has('m10_chorro')) return;
    host.setLocked(true);
    host.placePlayer('chorro');
    host.facePlayer('up');
    await host.say('m10_chorro_pre');
    const r = await rio('chorro');
    if (r.good || r.skipped) set('m10_chorro_bien');
    if (r.perfect) set('secreto_m10_polar');
    playMusic('rio');
    host.placePlayer('chorro');
    await host.wait(300);
    await host.say('m10_chorro_post');
    clockAt('dom 11:50', 'dom 12:20');
    host.setLocked(false);
  },

  /** Río abajo en neumático, del Puente 3 al Puente 4. */
  async corriente_m10(host) {
    if (has('m10_corriente')) return;
    while (Dialogue.active) await host.wait(200);
    host.setLocked(true);
    host.placePlayer('corriente_ini');
    await host.say('m10_corriente_pre');
    const r = await rio('corriente');
    if (r.good || r.skipped) set('m10_corriente_bien');
    if (r.perfect) set('secreto_m10_patico');
    clockAt('dom 12:25', 'dom 12:50');
    playMusic('rio');
    host.placePlayer('corriente_fin');
    await host.wait(400);
    await host.say('m10_corriente_post');
    host.setLocked(false);
  },

  /** El puente colgante: cruzarlo hasta la mitad y las fotos. */
  async puente_m10(host) {
    if (has('m10_puente')) return;
    host.setLocked(true);
    host.placePlayer('puente4_sur');
    host.facePlayer('up');
    await host.say('m10_puente_pre');
    const r = await rio('puente');
    if (r.good || r.skipped) set('m10_puente_bien');
    playMusic('rio');
    host.placePlayer('puente4_medio');
    await host.wait(300);
    await host.say('m10_puente_medio');
    const f = await rio('fotos');
    galeria = f.photos ?? [];
    if (f.good || f.skipped) set('m10_fotos_bien');
    if (f.barranquero) set('m10_foto_barranquero');
    const n = galeria.length;
    Dialogue.vars.set('fotos', n === 0 ? 'ninguna salió bien, pero igual se ven felices' : n === 1 ? `una buena: «${galeria[0]}»` : `${n} buenas: ${galeria.map((p) => `«${p}»`).join(', ')}`);
    playMusic('rio');
    host.placePlayer('puente4_medio');
    await host.wait(300);
    await host.say('m10_fotos_post');
    clockAt('dom 12:55', 'dom 13:20');
    host.setLocked(false);
  },

  /** El piedrón de la orilla: los recuerdos con Danilo. */
  async recuerdos_m10(host) {
    if (has('m10_recuerdos')) return;
    host.setLocked(true);
    host.placePlayer('piedra');
    host.facePlayer('right');
    clockAt('dom 13:05');
    await host.say('m10_recuerdos');
    clockAt('dom 13:30', 'dom 13:50');
    host.setLocked(false);
  },

  /** Donde doña Nelly: el almuerzo, la historia de Fotogram, Laura... y la vuelta. */
  async comida_m10(host) {
    if (has('m10_comio')) return;
    while (Dialogue.active) await host.wait(200);
    host.setLocked(true);
    set('m10_comio');
    host.placePlayer('mesa');
    host.facePlayer('up');
    clockAt('dom 13:45');
    await host.say('m10_comida');
    await clockTo(host, 'dom 14:20', 1200);
    await host.say('m10_historia_pre');
    const fotos = galeria.length > 0 ? galeria : ['El río verde'];
    const r = await rio('historia', fotos);
    if (r.good) set('m10_historia_completa');
    playMusic('rio');
    host.placePlayer('mesa');
    await host.wait(400);
    await host.say('m10_historia_post');
    // La subida por el sendero hasta el parqueadero.
    await host.fade(true, 1000);
    clear(FLAG_SWIM);
    danilo('ropa');
    StoryState.setWeather('nublado');
    StoryState.setClock(parseClock('dom 16:40'), parseClock('dom 16:45'));
    host.placePlayer('carro');
    await host.wait(500);
    await host.fade(false, 900);
    await host.say('m10_subida');
    set('m10_vuelta');
    danilo(null);
    playSfx('door');
    await host.fade(true, 700);
    host.goTo('carro_danilo', 'asiento');
  },

  /** En el 805, por fin: la cama. */
  async dormir_m10(host) {
    if (has('m10_durmio')) return;
    host.setLocked(true);
    set('m10_durmio');
    host.placePlayer('cama');
    StoryState.setWeather('lluvia');
    clockAt('dom 17:50');
    playMusic('depa');
    await host.say('m10_final');
    await host.fade(true, 1800);
    host.completeMission();
  },
};

/** La vuelta: el atardecer en la Vía a Pance, la charla y el sótano. */
async function vuelta(host: ScriptHost): Promise<void> {
  if (has('m10_vuelta_llego')) return;
  host.setLocked(true);
  playMusic('carro_danilo');
  await host.wait(500);
  banner(VUELTA[0].title, VUELTA[0].subtitle);
  await clockTo(host, VUELTA[0].at, 2400);
  await host.say('m10_carro_vuelta');
  banner(VUELTA[1].title, VUELTA[1].subtitle);
  await clockTo(host, VUELTA[1].at, 2000);
  await host.fade(true, 1200);
  playMusic(null);
  StoryState.setClock(parseClock('dom 17:35'), parseClock('dom 17:50'));
  set('m10_vuelta_llego');
  host.goTo('bobo_sotano', 'carro');
}
